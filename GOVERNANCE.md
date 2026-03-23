# Governance

This document describes how the AI Goat project is organized, maintained, and how decisions are made.

## Project Ownership

AI Goat is maintained by **AISecurityConsortium**, an initiative focused on building open tools and educational resources for AI security.

The project repository lives at:
[https://github.com/AISecurityConsortium/AIGoat](https://github.com/AISecurityConsortium/AIGoat)

## Maintainers

The current project maintainers are:

- **Farooq Mohammad** — [LinkedIn](https://www.linkedin.com/in/farooqmohammad/)
- **Nalinikanth M (Nal)** — [LinkedIn](https://www.linkedin.com/in/nalinikanth-m/)

Maintainers are responsible for:

- Reviewing and merging contributions
- Managing releases and version tags
- Maintaining the quality and integrity of training content
- Evolving the platform architecture and lab coverage
- Ensuring documentation stays accurate and accessible

## Decision Making

Maintainers make final decisions on:

- Platform architecture and technology choices
- Training content direction (labs, challenges, prompts)
- Release schedules and versioning
- Licensing and governance updates

Community input is welcome and encouraged. If you have ideas, suggestions, or concerns:

- **Open an issue** on the GitHub repository to start a discussion
- **Submit a pull request** with proposed changes
- Maintainers will review and respond in a reasonable timeframe

For larger changes (new features, architectural shifts, new lab categories), opening an issue first to discuss the approach is strongly recommended.

## Licensing Governance

AI Goat uses a dual licensing model to keep the platform open while protecting training materials:

- **Platform code** (backend, frontend, infrastructure, scripts) is licensed under **Apache License 2.0**. Anyone can use, modify, and distribute the code, including for commercial purposes.
- **Training content** (challenge evaluators, prompts, labs, walkthroughs, workshop materials) is licensed under **Creative Commons BY-NC-SA 4.0**. This content is free for learning, research, and non-commercial use. Commercial training usage requires permission from the maintainers.

Note: The challenge evaluation framework (`app/challenges/`) falls under CC BY-NC-SA 4.0 because the evaluators encode specific attack patterns, detection thresholds, and success criteria that represent the training methodology — not generic application logic.

This structure ensures the platform remains accessible to the community while preventing the training materials from being repackaged for commercial gain without authorization.

**Trademark**: "AI Goat" is a registered trademark of AISecurityConsortium. Commercial use of the name and branding requires permission.

For full details, see:

- [LICENSE](LICENSE) — Apache License 2.0 (platform code)
- [TRAINING_LICENSE.md](TRAINING_LICENSE.md) — commercial usage rules for training content
- [NOTICE](NOTICE) — complete licensing overview

## Future Contributors

External contributors are welcome. Whether you want to fix a bug, improve documentation, add a defensive technique, or propose a new lab idea, we appreciate the help.

All contributions should follow the guidelines in [CONTRIBUTING.md](CONTRIBUTING.md).

By contributing, you agree that your contributions will be licensed under the same terms as the rest of the project:

- Code contributions fall under Apache License 2.0
- Training content contributions fall under CC BY-NC-SA 4.0

