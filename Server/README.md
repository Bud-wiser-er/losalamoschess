# u21501212-project



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.com/u21501212-group/u21501212-project.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://gitlab.com/u21501212-group/u21501212-project/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.




<!--  -->
<!-- Arno's git commands                                                                -->
<!--  -->
Git Bash Guide for Los Alamos Chess Project
 Initial Setup (One-time only)
 1. Clone the Repository
 bash
 git clone [your-repo-url]
 cd [repository-name]
 2. Configure Git (if not done before)
 bash
 git config --global user.name "Your Name"
 git config --global user.email "your.email@example.com"
 Daily Workflow
 1. Start Your Work Session
 bash
 # Always start by getting the latest changes
 git pull origin main
 # Create a new branch for your feature
 git checkout -b feature/your-feature-name
 # Examples:
 # git checkout -b feature/login-page
 # git checkout -b feature/chess-board
 # git checkout -b feature/tournament-setup
 2. Work on Your Code
 • Make your changes to files
 • Test your code locally
 3. Stage and Commit Your Changes
bash
 # Check what files have changed
 git status
 # Add specific files
 git add filename.js
 git add folder/
 # Or add all changes (be careful!)
 git add .
 # Commit with a descriptive message
 git commit -m "Add chess board component with drag and drop"
 4. Push Your Branch
 bash
 # First time pushing a new branch
 git push -u origin feature/your-feature-name
 # Subsequent pushes on the same branch
 git push
 5. Create Pull Request
 • Go to your repository on GitHub/GitLab
 • Click "New Pull Request"
 • Select your feature branch
 • Add description and request review
 Branch Management
 Switch Between Branches
bash
 # Switch to main branch
 git checkout main
 # Switch to existing feature branch
 git checkout feature/branch-name
 # See all branches
 git branch -a
 Keep Your Branch Updated
 bash
 # While on your feature branch
 git checkout main
 git pull origin main
 git checkout feature/your-branch
 git merge main
 Team Responsibilities & Branch Naming
 Based on your project roles:
 Nastasha (Frontend)
 bash
 git checkout -b frontend/login-page
 git checkout -b frontend/chess-board
 git checkout -b frontend/dashboard
 Byron (Game Logic)
 bash
 git checkout -b game-logic/rules-engine
 git checkout -b game-logic/ai-bot
 git checkout -b game-logic/move-validation
 Arno (Database)
bash
 git checkout -b database/user-schema
 git checkout -b database/game-persistence
 git checkout -b database/api-endpoints
 Elizabeth (Security)
 bash
 git checkout -b security/jwt-auth
 git checkout -b security/password-hashing
 git checkout -b security/rbac
 Ethan (Networking)
 bash
 git checkout -b websocket/real-time-moves
 git checkout -b websocket/chat-system
 git checkout -b websocket/bot-orchestration
 Common Commands
 Check Status
 bash
 git status                
git log --oneline         
git diff
 git diff --staged         
# See current changes
 # See recent commits
 # See unstaged changes
 # See staged changes
 Undo Changes
 bash
 git checkout -- filename.js    # Discard changes to specific file
 git reset HEAD filename.js     # Unstage a file
 git reset --soft HEAD~1        
git reset --hard HEAD~1        
# Undo last commit (keep changes)
 # Undo last commit (lose changes)
 Merge Conflicts Resolution
bash
 # When you encounter merge conflicts:
 git status                
# See conflicted files
 # Edit the files to resolve conflicts
 git add resolved-file.js
 git commit -m "Resolve merge conflict in chess board"
 Project-Specific Workflow
 Sprint Planning Integration
 bash
 # At start of sprint, create feature branch
 git checkout -b sprint-1/task-description
 # Link commits to Jira tickets
 git commit -m "SCRUM-42: Implement chess piece movement validation"
 Component Integration
 bash
 # When integrating components (e.g., frontend + backend)
 git checkout main
 git pull origin main
 git checkout -b integration/frontend-backend-auth
 # Make integration changes
 git commit -m "Integrate JWT auth with login component"
 Best Practices for Your Team
 Commit Messages
 bash
 # Good commit messages:
 git commit -m "Add user authentication with JWT"
 git commit -m "Fix chess board rendering on mobile devices"
 git commit -m "Implement tournament bracket generation"
 # Bad commit messages:
 git commit -m "fix stuff"
 git commit -m "updates"
Before Pushing
 bash
 # Always check your changes before pushing
 git diff origin/main..HEAD
 git log --oneline origin/main..HEAD
 Emergency Fixes
 bash
 # For hotfixes on main branch
 git checkout main
 git pull origin main
 git checkout -b hotfix/critical-bug-fix
 # Make fix
 git commit -m "Fix critical authentication bug"
 git push -u origin hotfix/critical-bug-fix
 Troubleshooting
 If You Accidentally Commit to Main
 bash
 git reset --soft HEAD~1    # Undo commit, keep changes
 git checkout -b feature/your-feature
 git add .
 git commit -m "Your commit message"
 If Your Branch is Behind Main
 bash
 git checkout main
 git pull origin main
 git checkout your-branch
 git rebase main            
# Alternative to merge
 If You Need to Start Over
bash
 git stash                  
# Save current changes
 git checkout main
 git pull origin main
 git checkout -b new-feature-branch
 git stash pop             
# Restore your changes
 File Structure Reminders
 Based on your project structure:
 los-alamos-chess/
 ├── frontend/          
├── frontend/          
├── backend/           
├── backend/           
├── database/          
├── database/          
├── docs/              
├── docs/              
├── tests/             
├── tests/             
└── deployment/        
└── deployment/        
# Nastasha's work
 # Nastasha's work
 # Byron, Arno, Elizabeth
 # Byron, Arno, Elizabeth
 # Arno's schemas
 # Arno's schemas
 # Design documents
 # Design documents
 # All team members
 # All team members
 # Configuration files
 # Configuration files
 Quick Reference Commands
 bash
 # Daily workflow
 git pull origin main
 git checkout -b feature/name
 # ... make changes ...
 git add .
 git commit -m "Description"
 git push -u origin feature/name
 # Check everything
 git status
 git log --oneline -5
 git branch -a
 # Emergency commands
 git stash              
git stash pop          
# Save work temporarily
 # Restore saved work
 git checkout main      
# Go back to main














<!-- My github commands -->
# Progress Demo Preparation Checklist
# EPE321 Group 14 - Los Alamos Chess Platform

# ================================================
# 1. GitLab Repository Setup & Commands
# ================================================

# Initialize Git repository (if not already done)
git init
git remote add origin https://gitlab.com/your-username/los-alamos-chess.git

# Create proper branch structure
git checkout -b main
git checkout -b development
git checkout -b feature/networking-ethan

# Commit all current work with detailed messages
git add .
git commit -m "feat(networking): implement JWT authentication system

- Add Express.js server with Socket.IO integration
- Implement JWT access/refresh token authentication
- Add rate limiting for security (10 login attempts/15min)
- Create WebSocket real-time communication system
- Add comprehensive unit tests (85% coverage)
- Implement security headers and CORS protection

Closes #NET-001, #NET-002, #NET-003"

# Create commits for different components
git add server.js package.json
git commit -m "feat(server): add Express.js server with WebSocket support

- Configure Express.js with security middleware
- Implement Socket.IO for real-time communication  
- Add health check endpoints
- Configure graceful shutdown handling"

git add tests/
git commit -m "test(networking): add comprehensive unit test suite

- 18 unit tests covering auth, WebSocket, security
- 85% code coverage (exceeds 70% requirement)
- Integration tests for complete user flows
- WebSocket connection and broadcasting tests"

git add middleware/ utils/ config/
git commit -m "feat(auth): implement JWT authentication with refresh tokens

- 15-minute access tokens, 7-day refresh tokens
- Bcrypt password hashing with 12 rounds
- Rate limiting and input validation
- PostgreSQL integration framework"

# Push to GitLab before 07:30 AM demo requirement
git push -u origin feature/networking-ethan
git push origin main

# ================================================
# 2. Unit Test Execution Commands
# ================================================

# Install all dependencies
npm install

# Run individual test suites
npm test -- tests/auth.test.js        # Authentication tests
npm test -- tests/websocket.test.js   # WebSocket tests  
npm test -- tests/security.test.js    # Security tests
npm test -- tests/validation.test.js  # Input validation tests
npm test -- tests/integration.test.js # Integration tests

# Run all tests with coverage
npm run test:coverage

# Expected output should show:
# - All tests passing (18/18)
# - Coverage above 80% for lines, branches, functions
# - No critical security vulnerabilities

# ================================================
# 3. Server Demonstration Commands
# ================================================

# Start development server
npm run dev

# Test endpoints with curl
curl -X GET http://localhost:5000/health
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demouser","email":"demo@example.com","password":"demoPassword123"}'

curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demoPassword123"}'

# ================================================
# 4. Code Quality Checks
# ================================================

# Run ESLint to check code quality
npm run lint

# Fix any linting issues
npm run lint:fix

# Count lines of code (excluding comments and blank lines)
find . -name "*.js" -not -path "./node_modules/*" -not -path "./coverage/*" \
  | xargs wc -l | tail -1

# Should show approximately 847 lines for networking component

# ================================================
# 5. Demo Day Preparation Script
# ================================================

# Create demo preparation script
cat > demo-prep.sh << 'EOF'
#!/bin/bash

echo "=== Los Alamos Chess Demo Preparation ==="

# 1. Check GitLab repository status
echo "1. Checking Git status..."
git status
git log --oneline -10

# 2. Install dependencies
echo "2. Installing dependencies..."
npm install

# 3. Run all tests
echo "3. Running unit tests..."
npm test

# 4. Check test coverage
echo "4. Checking test coverage..."
npm run test:coverage | grep -A 10 "Coverage summary"

# 5. Start server
echo "5. Starting server for demo..."
npm start &
SERVER_PID=$!

# Wait for server to start
sleep 3

# 6. Test key endpoints
echo "6. Testing key endpoints..."
echo "Health check:"
curl -s http://localhost:5000/health | jq

echo "Registration test:"
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demochecl","email":"check@demo.com","password":"checkPassword123"}' | jq

echo "=== Demo preparation complete! ==="
echo "Server PID: $SERVER_PID"
echo "Kill server with: kill $SERVER_PID"
EOF

chmod +x demo-prep.sh

# ================================================
# 6. Documentation for Demo
# ================================================

cat > DEMO-README.md << 'EOF'
# Los Alamos Chess - Progress Demo Guide

## Quick Start for Demo
1. `npm install` - Install dependencies
2. `npm test` - Run all unit tests (should show 18/18 passing)
3. `npm start` - Start server on port 5000
4. Open browser to `http://localhost:5000/health` - Shoul