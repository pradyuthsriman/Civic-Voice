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

// Tell Express to serve files from the current directory
app.use(express.static(__dirname));

const issuesFilePath = path.join(__dirname, 'issues.json');
const approvedFilePath = path.join(__dirname, 'approved.json');

const upload = multer({ dest: 'uploads/' });

// API endpoint to report an issue
app.post('/api/report', upload.single('image'), (req, res) => {
    const newIssue = {
        id: Date.now(),
        ...req.body,
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

// API endpoint to get approved issues
app.get('/api/approved-issues', (req, res) => {
    fs.readFile(approvedFilePath, (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read approved issues file' });
        }
        res.json(JSON.parse(data));
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