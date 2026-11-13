# Employee Portal Mobile Prototype

## Sign-in flow — complete
- Provide a portrait-first iOS and Android sign-in screen for the Employee Portal prototype.
- Include a realistic prototype authentication flow that transitions into the secured app experience without requiring production API integration.
- Preserve the source portal context and use appropriate mobile controls and feedback.

## Authenticated dashboard and navigation — complete
- Provide an authenticated app shell reflecting the source portal’s navigation and Optimum/Keywest company identity.
- Present the employee identity **Que, Evangeline Tang** within the authenticated experience.
- Show representative employee portal dashboard content and clear access to the primary actions.
- Include a visible notification affordance within the authenticated navigation or dashboard context.
- Support portrait, one-handed navigation with platform-appropriate interactions.

## Daily Sales submission — complete
- Make Daily Sales the primary form for the prototype because it is the user’s main purpose.
- Provide the source-aligned **Sales Date**, **Location**, **Store**, **Items**, **Item**, **Quantity**, **Total Amount**, **Add Item**, **Save**, and **Cancel** controls.
- Include a mobile item selector using representative products from the source portal, editable quantity and amount fields, a running total, and validation for incomplete optional item rows.
- Allow saving with only a **Daily total amount** and no item rows; item details remain optional.
- Provide a **Save Daily Sales** action with confirmation feedback and dashboard activity state.

## Leave Request submission — complete as secondary form
- Provide a Leave Request form with **From Date**, **To Date**, **Total Days**, **Leave Credit**, **Location**, **Store**, **Pay**, and **Reason** fields.
- Use appropriate mobile controls, date selection, required-field feedback, and representative calculation or display of leave details.
- Provide a **Save** action that completes a realistic prototype submission flow with user feedback.
- Provide **Cancel** behavior that safely exits or resets the request.

## Prototype delivery — complete
- Deliver a working cross-platform mobile prototype for iOS and Android.
- Keep production API integration, app-store submission, and release credentials out of this prototype stage.

## Separate Daily Sales integration inbox — complete for staging
- The mobile app writes Daily Sales through the project API to a separate `daily_sales_inbox` table; it does not read or expose the existing portal database.
- Accept Sales Date, Employee ID, Location, Store, Daily Total Amount, and optional Items.
- Support amount-only reports with an empty item list.
- Use a unique idempotency key and `pending` status so the portal-side worker can process records without duplicates.
- Keep the current endpoint as internal staging until real app authentication is added.

## Controlled 2–3 staff pilot — blocked pending auth/distribution details
- Prepare a pilot for 2–3 named staff using the existing integration setup and keeping the portal database private.
- Do not distribute the current prototype sign-in because it accepts any non-empty credentials and exposes a test-access shortcut.
- Obtain the approved pilot authentication method, pilot staff IDs, API base URL, distribution method, pilot dates, and support contact before sharing a staff link or build.
- Provide a status check that confirms `pending → processing → processed` or records `failed`, with duplicate prevention.
