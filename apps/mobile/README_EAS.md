# EAS Build Configuration

This document explains how to build and deploy the CaseCurrent mobile app using Expo Application Services (EAS).

## Prerequisites

1. **Expo Account**: Create a free account at [expo.dev](https://expo.dev)
2. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```
3. **Login to EAS**:
   ```bash
   eas login
   ```

## Project Setup

The mobile app is configured in `apps/mobile/` with the following identifiers:

- **iOS Bundle ID**: `io.casecurrent.app`
- **Android Package**: `io.casecurrent.app`
- **URL Scheme**: `casecurrent://`

## Build Profiles

Three build profiles are available in `eas.json` at the repo root:

| Profile | Distribution | API URL | Use Case |
|---------|-------------|---------|----------|
| `development` | Internal | casecurrent.co | Dev builds with Expo Go |
| `preview` | Internal | casecurrent.co | Testing before production |
| `production` | App Store | casecurrent.co | Store-ready builds |

## Commands

Run these commands from the `apps/mobile/` directory:

```bash
# Start local development server
npm run start

# Build for development (internal distribution)
npm run eas:build:dev

# Build for preview/testing
npm run eas:build:preview

# Build for production (App Store/Play Store)
npm run eas:build:prod
```

Alternatively, run directly with eas-cli:

```bash
cd apps/mobile
eas build --profile development
eas build --profile preview
eas build --profile production
```

## Environment Variables

The `EXPO_PUBLIC_API_BASE_URL` environment variable controls which backend the app connects to:

- **All Profiles**: `https://casecurrent.co`

These are set automatically per profile in `eas.json`. The app falls back to `https://casecurrent.co` if the variable is not set.

## First-Time Setup

Before your first build, you'll need to configure EAS for your project:

```bash
cd apps/mobile
eas build:configure
```

This will:
1. Link the project to your Expo account
2. Generate the `EAS_PROJECT_ID` for `app.config.ts`
3. Set up initial build settings

## Submitting to App Stores

After a successful production build, submit to stores:

```bash
# Submit to Apple App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

Note: App store submissions require:
- **iOS**: Apple Developer account ($99/year), App Store Connect setup
- **Android**: Google Play Developer account ($25 one-time), Play Console setup

## Build Artifacts

EAS builds happen in Expo's cloud infrastructure. After a build completes:

1. Download the `.ipa` (iOS) or `.apk`/`.aab` (Android) from [expo.dev](https://expo.dev)
2. For internal distribution, team members receive install links via email
3. For production builds, use `eas submit` to upload to stores

## Credentials

EAS manages signing credentials automatically:

- **iOS**: Provisioning profiles and certificates are stored in Expo's secure credential manager
- **Android**: Keystore is generated and stored securely by EAS

To view/manage credentials:
```bash
eas credentials
```

## Troubleshooting

### Build fails with missing EAS_PROJECT_ID
Run `eas build:configure` to link the project to your Expo account.

### iOS build fails with certificate issues
Run `eas credentials` and follow prompts to regenerate certificates.

### Android build fails with keystore issues
Run `eas credentials --platform android` to manage the keystore.

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Expo Configuration Reference](https://docs.expo.dev/versions/latest/config/app/)
