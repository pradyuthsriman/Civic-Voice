const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
// The updated line: uses the environment port or defaults to 3000
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Storage setup for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// In-memory data storage (for simplicity)
let issues = [];
let users = {};

// Helper function to find a user by ID
function findUser(userId) {
    return Object.values(users).find(u => u.id === userId);
}

// Routes
app.post('/register', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }
    
    // Simple check to ensure username is unique
    const existingUser = Object.values(users).find(u => u.username === username);
    if (existingUser) {
        return res.status(409).json({ message: 'Username already exists' });
    }

    const userId = 'user-' + Date.now();
    users[userId] = { id: userId, username: username };
    res.json({ message: 'User registered successfully', userId: userId });
});

app.post('/submit', upload.single('photo'), (req, res) => {
    const { description, location, category } = req.body;
    const photo = req.file ? req.file.filename : null;
    const newIssue = {
        id: 'issue-' + Date.now(),
        description,
        location,
        category,
        photo,
        status: 'pending',
        upvotes: 0,
        downvotes: 0,
        votedBy: []
    };
    issues.push(newIssue);
    res.json({ message: 'Issue submitted successfully', issue: newIssue });
});

app.get('/issues', (req, res) => {
    const pendingIssues = issues.filter(issue => issue.status === 'pending');
    res.json(pendingIssues);
});

app.get('/approved', (req, res) => {
    const approvedIssues = issues.filter(issue => issue.status === 'approved');
    res.json(approvedIssues);
});

app.post('/approve/:id', (req, res) => {
    const { id } = req.params;
    const issue = issues.find(i => i.id === id);
    if (issue) {
        issue.status = 'approved';
        res.json({ message: 'Issue approved' });
    } else {
        res.status(404).json({ message: 'Issue not found' });
    }
});

app.post('/reject/:id', (req, res) => {
    const { id } = req.params;
    const issueIndex = issues.findIndex(i => i.id === id);
    if (issueIndex > -1) {
        issues.splice(issueIndex, 1);
        res.json({ message: 'Issue rejected and removed' });
    } else {
        res.status(404).json({ message: 'Issue not found' });
    }
});

app.post('/vote/:id', (req, res) => {
    const { id } = req.params;
    const { voteType, userId } = req.body;
    
    const issue = issues.find(i => i.id === id);
    const user = findUser(userId);

    if (!issue || !user) {
        return res.status(404).json({ message: 'Issue or user not found' });
    }

    if (issue.votedBy.includes(userId)) {
        return res.status(409).json({ message: 'You have already voted on this issue.' });
    }

    if (voteType === 'upvote') {
        issue.upvotes++;
    } else if (voteType === 'downvote') {
        issue.downvotes++;
    }
    
    issue.votedBy.push(userId);
    res.json({ message: 'Vote recorded' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});