/**
 * EmailService for sending password reset emails
 * Integrates with nodemailer for email delivery
 */
const nodemailer = require('nodemailer');

class EmailService {
    constructor(config = {}) {
        this.config = {
            service: config.service || process.env.EMAIL_SERVICE || 'gmail',
            user: config.user || process.env.EMAIL_USER,
            password: config.password || process.env.EMAIL_PASSWORD,
            from: config.from || process.env.EMAIL_FROM || 'Los Alamos Chess <noreply@losalamoschess.com>'
        };

        this.transporter = null;
        this.initialized = false;
    }

    /**
     * Initialize the email service
     */
    async initialize() {
        try {
            // Check if email credentials are configured
            if (!this.config.user || !this.config.password ||
                this.config.user === 'your-email@gmail.com' ||
                this.config.password === 'your-app-password-here' ||
                this.config.password === 'your-app-password') {
                console.log('⚠️  Email service not configured - using console output for demo');
                this.initialized = false;
                return false;
            }

            this.transporter = nodemailer.createTransport({
                service: this.config.service,
                auth: {
                    user: this.config.user,
                    pass: this.config.password
                }
            });

            // Verify the connection
            await this.transporter.verify();
            console.log('✅ Email service initialized successfully');
            this.initialized = true;
            return true;
        } catch (error) {
            console.log('⚠️  Email service initialization failed - using console output for demo');
            console.log('   Error:', error.message);
            this.initialized = false;
            return false;
        }
    }

    /**
     * Send password reset email with OTP code
     * @param {string} email - Recipient email
     * @param {string} resetCode - 6-digit reset code
     * @param {string} username - User's username
     * @returns {Promise<boolean>} - Success status
     */
    async sendPasswordResetCode(email, resetCode, username = '') {
        const subject = 'Los Alamos Chess - Password Reset Code';
        const html = this.generateResetEmailTemplate(resetCode, username);

        if (!this.initialized) {
            // Demo mode - log to console
            console.log('📧 EMAIL DEMO MODE - Password Reset Code');
            console.log(`   To: ${email}`);
            console.log(`   Subject: ${subject}`);
            console.log(`   Reset Code: ${resetCode}`);
            console.log('   (Email service not configured - check your environment variables)');
            return true;
        }

        try {
            const mailOptions = {
                from: this.config.from,
                to: email,
                subject: subject,
                html: html
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Password reset email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send password reset email:', error.message);
            // Fallback to console for demo
            console.log('📧 EMAIL FALLBACK - Password Reset Code');
            console.log(`   To: ${email}`);
            console.log(`   Reset Code: ${resetCode}`);
            return false;
        }
    }

    /**
     * Generate HTML template for password reset email
     * @param {string} resetCode - 6-digit reset code
     * @param {string} username - User's username
     * @returns {string} - HTML email template
     */
    generateResetEmailTemplate(resetCode, username) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Password Reset - Los Alamos Chess</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .code-box { background: #fff; border: 2px solid #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
                .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; }
                .warning { background: #fef3cd; border: 1px solid #faebcc; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🏰 Los Alamos Chess</h1>
                    <h2>Password Reset Request</h2>
                </div>
                <div class="content">
                    <p>Hello${username ? ' ' + username : ''},</p>

                    <p>We received a request to reset your password for your Los Alamos Chess account. Use the verification code below to complete your password reset:</p>

                    <div class="code-box">
                        <div class="code">${resetCode}</div>
                        <p><strong>Verification Code</strong></p>
                    </div>

                    <div class="warning">
                        <strong>Important:</strong>
                        <ul>
                            <li>This code will expire in <strong>10 minutes</strong></li>
                            <li>If you didn't request this password reset, please ignore this email</li>
                            <li>Never share this code with anyone</li>
                        </ul>
                    </div>

                    <p>To complete your password reset:</p>
                    <ol>
                        <li>Return to the password reset page</li>
                        <li>Enter the verification code above</li>
                        <li>Create your new password</li>
                    </ol>

                    <p>If you're having trouble, please contact our support team.</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from Los Alamos Chess.<br>
                    Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Send welcome email to new users (optional feature)
     * @param {string} email - User email
     * @param {string} username - Username
     * @returns {Promise<boolean>} - Success status
     */
    async sendWelcomeEmail(email, username) {
        if (!this.initialized) {
            console.log(`📧 Welcome email would be sent to ${email} (${username})`);
            return true;
        }

        try {
            const mailOptions = {
                from: this.config.from,
                to: email,
                subject: 'Welcome to Los Alamos Chess!',
                html: this.generateWelcomeEmailTemplate(username)
            };

            await this.transporter.sendMail(mailOptions);
            console.log(`✅ Welcome email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send welcome email:', error.message);
            return false;
        }
    }

    /**
     * Generate welcome email template
     * @param {string} username - User's username
     * @returns {string} - HTML email template
     */
    generateWelcomeEmailTemplate(username) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Welcome to Los Alamos Chess</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🏰 Welcome to Los Alamos Chess!</h1>
                </div>
                <div class="content">
                    <p>Hello ${username},</p>

                    <p>Welcome to Los Alamos Chess! Your account has been successfully created and you're ready to start playing.</p>

                    <p>Los Alamos Chess is the historic variant played on a 6x6 board - perfect for quick games and learning chess fundamentals.</p>

                    <a href="#" class="cta-button">Start Playing Now</a>

                    <p>Features available to you:</p>
                    <ul>
                        <li>Play against other players online</li>
                        <li>Challenge our AI opponents</li>
                        <li>Track your rating and progress</li>
                        <li>Join tournaments and competitions</li>
                    </ul>

                    <p>If you have any questions, feel free to reach out to our support team.</p>

                    <p>Happy playing!</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from Los Alamos Chess.<br>
                    Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

module.exports = EmailService;