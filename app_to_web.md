# Android Cross App and Web Attribution Measurement

## Authors:
*   Charlie Harrison
*   Michael Thiessen
*   John Delaney

## Participate
See [Participate](https://github.com/WICG/conversion-measurement-api#participate).
Please file [GitHub issues](https://github.com/WICG/conversion-measurement-api/issues?q=is%3Aissue+is%3Aopen+label%3Aapp-to-web+) with the `app-to-web` label.


## Introduction

Currently, the [Attribution Reporting API](https://github.com/WICG/conversion-measurement-api) supports attributing events within a single browser instance. This proposal expands the scope of attribution to allow attributing conversions that happen on the web to events that happen off the browser, within other applications.

Any browser on Android could implement this API. This proposal was inspired by Safari's [App-to-web support in Private Click Measurement](https://webkit.org/blog/11529/introducing-private-click-measurement-pcm/#:~:text=App-to-Web).


## Goals

*   Support measurement of ads that show up within apps that later convert in the browser
*   Support measurement of ads within embedded webview that later convert in the browser
*   Support both clicks and views


## API changes


### Existing Web API (for reference)

See [explainer](https://github.com/WICG/conversion-measurement-api/blob/main/event_attribution_reporting_clicks.md#registering-attribution-sources-for-anchor-tag-navigations).
```
<!-- Click-through attributions: -->
<a 
  href="https://advertiser.example/buy-shoes"
  attributionsourceeventid="123456"
  attributionreportto="https://reporter.example"
  attributiondestination="https://advertiser.example"
  attributionexpiry=604800000>
  Click me!
</a>
```


TODO: Design for view-through attribution is still TBD, with some initial API surface [here](https://github.com/WICG/conversion-measurement-api/blob/main/AGGREGATE.md#view-through-conversions-1) for aggregate. There is an [open issue](https://github.com/WICG/conversion-measurement-api/issues/98) for support in the event-level API.


### Registering clicks from apps

To register clicks from apps, we can send an ACTION_VIEW Intent with some extra parameters to configure the API. The extra parameters are embedded within a [PendingIntent](https://developer.android.com/reference/android/app/PendingIntent) the browser will self-fire.

```java
// After an ad click, in response to some InputEvent `inputEvent`

// Craft the inner Intent which the user's browser will self-fire. For browsers not
// supporting attributions, this inner Intent will simply be ignored.

// TODO: which namespace should the APP_ATTRIBUTION Action live in?
Intent innerIntent = new Intent("android.web.action.APP_ATTRIBUTION");

// Required for the PendingIntent to launch Chrome.
innerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

// Set the attribution parameters.
Bundle innerBundle = new Bundle();
innerBundle.putString("attributionSourceEventId", "123456");
innerBundle.putString("attributionReportTo", "https://reporter.example");
innerBundle.putString("attributionDestination", "https://advertiser.example");
innerBundle.putLong("attributionExpiry", 604800000);

// Put the input event that triggered the ad click in the bundle. The browser will
// verify this with the system on Android 11+.
// To be sure that the input event will verify on the browser side, apps could
// pre-verify by calling InputManger.verifyInputEvent here.
innerBundle.putParcelable(inputEvent);
innerIntent.putExtras(innerBundle);

// Choose a browser and set the Package on the Intent to ensure the inner Intent is sent to
// the same browser as the outer Intent. Note that choosing a browser may be difficult to
// implement correctly in the case where the user has not set a default handler for VIEW
// Intents, and is not covered here. When possible the default browser should be used.
String browserPackage = getbrowserPackageName();
innerIntent.setPackage(browserPackage);

// Create a PendingIntent for the Intent so that the browser can verify the source of the
// attribution parameters.
PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, innerIntent,
        PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_ONE_SHOT);

// Craft the outer Intent which will actually start the browser activity and
// navigate to a URL, adding the PendingIntent as an Extra.
Intent outerIntent = new Intent(Intent.ACTION_VIEW);
outerIntent.setData(Uri.parse("https://advertiser.example/buy-shoes"));

Bundle outerBundle = new Bundle();
outerBundle.putParcelable("android.web.extra.CONVERSION_INTENT", pendingIntent);
outerIntent.putExtras(outerBundle);
outerIntent.setPackage(browserPackage);
context.startActivity(outerIntent);
```



### Registering views from apps

Views won't necessarily start the browser with an Intent, so we can use a [ContentProvider](https://developer.android.com/reference/android/content/ContentProvider) to communicate events the browser.

```java
// One-time setup

// Choose a browser to send the attribution event to. Note that choosing a browser may be difficult to
// implement correctly in the case where the user has not set a default handler for VIEW
// Intents, and is not covered here. When possible the default browser should be used.
String browserPackage = getbrowserPackageName();

String authority = browserPackage + ".AttributionReporting/";
Uri providerUri = Uri.parse("content://" + authority);


// Sending the attribution after an ad view. Parameters for event-level API only.

// The client may be held onto for the duration of a session where multiple attributions may be
// reported.
ContentProviderClient client = context.getContentResolver().acquireContentProviderClient(providerUri);

ContentValues attributionValues = new ContentValues();
attributionValues.put("attributionSourceEventId", "123456");
attributionValues.put("attributionReportTo", "https://reporter.example");
attributionValues.put("attributionDestination", "https://advertiser.example");
attributionValues.put("attributionExpiry", 604800000);

try {
  client.insert(providerUri, attributionValues);
} catch (Exception e) {
  // Always catch exceptions thrown by ContentProviders so an error in the browser cannot crash your app.
}

// The client should be closed when no longer needed (eg. your app is no longer foreground).
client.close();
```



### Unifying events from Webviews with the browser

When the Attribution Reporting API is used in web content within a WebView, it could (via some new opt-in WebView API) internally use these techniques in the background to communicate with the browser and unify events.

However, we cannot directly unify events in WebView "as if" they happened in the browser, due to the fact that Webviews (even the system WebView) are inherently controlled by their embedders.

As such, we cannot trust a WebView to accurately report things like the source origin of an event. For WebView the best we can do without major architectural changes (e.g. cross process rendering) is to attribute events to the embedding APK like any other app.

Any other suggested solutions to this problem are appreciated!

## Computing Origins from Apps

An Origin will be constructed from the Package Name of the app reporting the events, and will take the form: android-app://<packageName>


## Privacy considerations

This proposal explicitly links data from app and web contexts, which is a new form of data that the web platform has not had explicit access to before. It enables apps to learn coarse user behavior patterns in the browser in the same way that the existing Attribution Reporting API allows websites to learn coarse user behavior patterns in the browser. In other words, we can safely think of an app as a particular "kind of website", and we can share data to apps that we’d be comfortable sharing to a (cross-site) website.

Additionally, depending on implementation decisions, browsers may add new, temporary storage to collect app events before unifying them with the browser’s collection of events produced by websites. Any new storage should be cleared when the user deletes their site data for the site of any of the source, attributionDestination, or reportTo origins.


### **Verifying Clicks**

One important piece of the existing API is gating some API features on [transient user activation](https://html.spec.whatwg.org/multipage/interaction.html#transient-activation), since they are initiated by explicit user actions. Where possible, the system can attempt to replicate this functionality by using <code>[VerifiedInputEvents](https://developer.android.com/reference/android/view/VerifiedInputEvent)</code>. On OS versions without VerifiedInputEvents, we could allow these features if they open the browser in the foreground, as a proxy for user engagement.


## Security considerations


### API threat model: protection on uncompromised systems

We assume an attacking app is not hosted on a completely compromised device, but can run arbitrary code otherwise.

We are aiming for protection from the following threats:

*   Malicious apps sending fake clicks without real user interaction
    *   Protected / mitigated by verified input events on Android 11+
*   Malicious apps sending messages (clicks / views) on behalf of other apps, without their permission
    *   Protected by properly using [PendingIntents](https://developer.android.com/reference/android/app/PendingIntent) for clicks and [ContentProvider](https://developer.android.com/reference/android/content/ContentProvider) for views which reliably indicate the message sender
*   Malicious apps sending events associated with reporting origins (ad-tech) that don’t want to receive the events
    *   Potentially protected the same way as web, by optionally allowing private authentication flows (see [issues](https://github.com/WICG/conversion-measurement-api/issues?q=is%3Aissue+is%3Aopen+fraud+label%3A%22anti-fraud+%2F+auth%22))


Note we are explicitly _not_ adding protection from:

*   Apps sending fake views without the user actually seeing the ad. This matches our web API which offers no viewability guarantees from the browser
*   Apps sending fake “ad clicks” when the user performs a verified input without actually seeing / clicking on the ad itself.


###  API threat model: protection on compromised system

For a completely compromised system, we will rely exclusively on some of the “blind-signature” style private authentication proposals that are being explored in the API (see [issues](https://github.com/WICG/conversion-measurement-api/issues?q=is%3Aissue+is%3Aopen+fraud+label%3A%22anti-fraud+%2F+auth%22)). These ideas are compatible with app attribution.


### Platform click verification

There are a few reasons we’d want to validate clicks with the Android system before sending them to the browser.


1. For privacy, we ideally want to privilege only ads engagement with explicit user interaction
2. Ads want some assurance that clicks actually happened and were not spam. Verification from the system protects against many spam attacks short of a completely compromised system
3. Alignment with Safari’s Private Click Measurement App-to-web implementation.

In Android 11+, there are <code>[VerifiedInputEvents](https://developer.android.com/reference/android/view/VerifiedInputEvent)</code> which are verified by the system. Normal <code>[InputEvents](https://developer.android.com/reference/android/view/InputEvent)</code> can be verified by the system by calling <code>[InputManager.verifyInputEvent(InputEvent)](https://developer.android.com/reference/android/hardware/input/InputManager#verifyInputEvent(android.view.InputEvent))</code>.

The browser can verify clicks by having an API surface that receives parceled InputEvents in the view Intent, and subsequently calling `InputManager.verifyInputEvent(InputEvent)`. This design allows the API to be backward compatible, and verify events on a best-effort basis.

**Note: It is a non-goal to attempt to verify clicks from a compromised system.**


## Appendix


## Scalability with many browsers

In the current API proposal, view messages could be sent to any number of browsers that support the API on the system, which could grow to be difficult to manage.

If this API proves itself to be useful, we could attempt to get platform level support in the future to have a unified interface for cross app attribution measurement.


## References & acknowledgements

Apple has announced a [similar feature](https://webkit.org/blog/11529/introducing-private-click-measurement-pcm/#:~:text=App-to-Web) to support conversions within Safari to be attributed to app clicks on iOS.
