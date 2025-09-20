const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const issuesFilePath = path.join(__dirname, 'issues.json');
const approvedFilePath = path.join(__dirname, 'approved.json');
const usersFilePath = path.join(__dirname, 'users.json');

const upload = multer({ dest: 'uploads/' });

// API endpoint for user registration
app.post('/api/register', (req, res) => {
    const { username, email, phone } = req.body;
    
    fs.readFile(usersFilePath, (err, data) => {
        const users = err ? [] : JSON.parse(data);
        
        // Check for existing user
        const userExists = users.some(user => user.username === username || user.email === email);
        if (userExists) {
            return res.status(409).json({ message: 'Username or email already exists.' });
        }

        const newUser = {
            id: Date.now().toString(), // Use toString() to ensure a string ID
            username,
            email,
            phone
        };
        users.push(newUser);

        fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Failed to save user data.' });
            }
            res.status(201).json({ message: 'User registered successfully!', userId: newUser.id });
        });
    });
});

// API endpoint to report an issue - now expects userId
app.post('/api/report', upload.single('image'), (req, res) => {
    const { description, location, category, userId } = req.body;
    
    const newIssue = {
        id: Date.now(),
        description,
        location,
        category,
        userId: userId, // Add the userId to the issue object
        image: req.file ? req.file.path : null,
        status: 'pending'
    };

    fs.readFile(issuesFilePath, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read issues file' });
        }
        const issues = JSON.parse(data);
        issues.push(newIssue);
        fs.writeFile(issuesFilePath, JSON.stringify(issues, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to write issues file' });
            }
            res.json({ message: 'Issue reported successfully!' });
        });
    });
});

// API endpoint to get all issues
app.get('/api/issues', (req, res) => {
    fs.readFile(issuesFilePath, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read issues file' });
        }
        res.json(JSON.parse(data));
    });
});

// API endpoint to get approved issues - now includes reporter's username
app.get('/api/approved-issues', (req, res) => {
    fs.readFile(approvedFilePath, (err, issuesData) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read approved issues file' });
        }
        const issues = JSON.parse(issuesData);
        
        fs.readFile(usersFilePath, (err, usersData) => {
            if (err) {
                // Return issues without usernames if user data is unavailable
                console.error("Failed to read users file:", err);
                return res.json(issues);
            }
            const users = JSON.parse(usersData);
            const usersMap = {};
            users.forEach(user => {
                usersMap[user.id] = user.username;
            });

            const issuesWithUsernames = issues.map(issue => {
                return {
                    ...issue,
                    username: usersMap[issue.userId] || 'Anonymous'
                };
            });
            
            res.json(issuesWithUsernames);
        });
    });
});

// API endpoint to get a single issue by ID
app.get('/api/issues/:id', (req, res) => {
    fs.readFile(issuesFilePath, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read issues file' });
        }
        const issues = JSON.parse(data);
        const issue = issues.find(i => i.id == req.params.id);
        if (issue) {
            res.json(issue);
        } else {
            res.status(404).json({ error: 'Issue not found' });
        }
    });
});

// API endpoint for moderator to approve or reject an issue
app.post('/api/moderator/:id', (req, res) => {
    const { status } = req.body;
    fs.readFile(issuesFilePath, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read issues file' });
        }
        let issues = JSON.parse(data);
        const issueIndex = issues.findIndex(i => i.id == req.params.id);

        if (issueIndex === -1) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        const issue = issues[issueIndex];
        issue.status = status;

        if (status === 'approved') {
            fs.readFile(approvedFilePath, (err, data) => {
                const approvedIssues = err ? [] : JSON.parse(data);
                approvedIssues.push(issue);
                fs.writeFile(approvedFilePath, JSON.stringify(approvedIssues, null, 2), (err) => {
                    if (err) return res.status(500).json({ error: 'Failed to write approved issues file' });
                    // Remove from issues.json
                    issues = issues.filter(i => i.id != req.params.id);
                    fs.writeFile(issuesFilePath, JSON.stringify(issues, null, 2), (err) => {
                        if (err) return res.status(500).json({ error: 'Failed to update issues file' });
                        res.json({ message: 'Issue approved and moved to approved.json' });
                    });
                });
            });
        } else if (status === 'rejected') {
            // Remove from issues.json
            issues = issues.filter(i => i.id != req.params.id);
            fs.writeFile(issuesFilePath, JSON.stringify(issues, null, 2), (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to update issues file' });
                }
                res.json({ message: 'Issue rejected and removed' });
            });
        } else {
            res.status(400).json({ error: 'Invalid status' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});