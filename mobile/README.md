# Roomie mobile app

This Flutter app is a separate native client for the Roomie FastAPI backend. It
supports selecting a seeded demo profile, browsing and liking/passing on
roommates, viewing mutual matches and compatibility details, updating lifestyle
onboarding, changing the co-ed preference, and running the sandbox KYC flow.
The existing Next.js website remains in `frontend/`.

The backend does not currently expose a messaging API. The app shows mutual
matches and their conversation starters, but does not send or persist chat
messages. Sandbox KYC is a simulation, not identity verification; production
KYC requires a configured OAuth provider.

## Requirements

- Flutter SDK (stable) with Android and/or iOS tooling installed
- A running Roomie backend with demo data (see the repository README)

From this directory, fetch dependencies and run the app:

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000
```

`10.0.2.2` is the Android emulator's host-machine alias. Use
`http://localhost:8000` for an iOS simulator, or set `API_BASE_URL` to a
reachable HTTPS API URL for a physical device. Do not use `localhost` on a
physical device unless the backend runs on that device.

The API URL can be set for release builds as well:

```bash
flutter build appbundle --dart-define=API_BASE_URL=https://your-api.example.com
flutter build ios --dart-define=API_BASE_URL=https://your-api.example.com
```

The Android and iOS runner projects are included. Android permits cleartext
traffic only in debug builds for local development; release builds should use
an HTTPS API. Before distribution, replace the example application identifiers
(`com.example.roomie_mobile`) with identifiers owned by your organization,
configure signing, and prepare the privacy policy and store metadata. This
repository does not include developer signing credentials or publish builds
to the stores.
