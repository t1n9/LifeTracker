# Changelog

All notable changes to the LifeTracker project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - 2026-04-08

### Added
- 🤖 **AI Toolbox**: Modular AI features container with tool selection menu
- 📊 **AI-Powered Study Analysis**: Integrated LLM (GLM-4-Flash) for intelligent learning insights
  - Health score calculation with consistency, duration, variety, and efficiency factors
  - Personalized insights and recommendations based on study patterns
  - Query history persistence to database
- ✨ **Enhanced UI/UX**: Improved visual design with glassmorphic elements and smooth animations

### Changed
- Removed Chakra UI dependency, switched to CSS Variables + inline styles for better control
- Refactored study analysis UI with modular component architecture
- Updated dashboard to integrate AI Toolbox component

### Fixed
- CSS hover effects stability and consistency across components
- AI API error handling with detailed logging

## [3.0.0] - 2026-01-30

### Added
- 🔄 **GitHub Actions Deployment**: Automated CI/CD pipeline with SSH-based server deployment
- 📝 **Study Analysis Service**: Backend service for analyzing study patterns
- 🔍 **Data Persistence**: Added StudyAnalysisQuery model for storing analysis results
- 📊 **Query History**: Ability to save and retrieve analysis queries

### Changed
- Deployment strategy changed from GitHub CI compilation to server-side git pull + build
- Simplified deployment pipeline by leveraging existing server-side git repository

### Breaking
- GitHub Actions deployment now requires SSH_PRIVATE_KEY and SERVER_HOST secrets

## [2.5.0] - 2025-12-15

### Added
- 🎨 **Dark Mode Support**: Full dark mode theme with CSS variables
- 📱 **Mobile Optimization**: Improved responsive design for mobile devices
- 🔔 **Notification System**: User notifications for important events

### Fixed
- Database migration issues
- CORS configuration bugs

## [2.0.0] - 2025-09-01

### Added
- 🎯 **Countdown Feature**: Customizable countdown timers for important dates
- 🍅 **Pomodoro Timer**: Configurable focus time management with task binding
- 📚 **Task Management**: Create, update, and track study tasks
- 📊 **Statistics Dashboard**: View learning statistics by subject and time period
- 💰 **Expense Tracking**: Record and analyze daily expenses
- 🏃 **Exercise Tracking**: Log workouts and fitness activities
- 🔐 **User Authentication**: Secure user registration and login with JWT
- 📧 **Email Verification**: Email-based user registration verification

### Technical
- Built with Next.js 15 (frontend) and NestJS (backend)
- PostgreSQL database with Prisma ORM
- Docker containerization support
- Nginx reverse proxy with Let's Encrypt SSL

## [1.0.0] - 2025-08-01

### Added
- Initial release of LifeTracker
- Basic project structure and setup
- Core counting-down feature
- User dashboard
- Basic data storage with PostgreSQL

---

## Unreleased

### Planned
- [ ] Advanced AI features (planning assistant, data summarization)
- [ ] Real-time collaboration features
- [ ] Mobile app (React Native)
- [ ] Advanced analytics and reporting
- [ ] Integration with popular calendar services

## How to Contribute

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
