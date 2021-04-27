# Android Cross App and Web Attribution Measurement

## Authors:
*   Charlie Harrison
*   Michael Thiessen
*   John Delaney

## Participate
* Please file [Github issues](https://github.com/WICG/conversion-measurement-api/issues?q=is%3Aissue+is%3Aopen+label%3Aapp-to-web+) with the "app-to-web" label


## Introduction

Currently, the [Attribution Reporting API](https://github.com/WICG/conversion-measurement-api) supports attributing events within a single browser instance. This proposal expands the scope of attribution to allow attributing conversions that happen on the web to events that happen off the browser, within other applications.

Any browser on Android could implement this API. This proposal was inspired by Safari's [App-to-web support in Private Click Measurement](https://webkit.org/blog/11529/introducing-private-click-measurement-pcm/#:~:text=App-to-Web).


## Goals

*   Support measurement of ads that show up within apps that later convert in the browser
*   Support measurement of ads within embedded webview that later convert in the browser
*   Support both clicks and views


## API changes


### Existing Web API (for reference)

See [explainer](https://github.com/WICG/conversion-measurement-api/blob/main/README.md#registering-attribution-sources-for-anchor-tag-navigations).
```
<!-- Click-through attributions: -->
<a 
  href="https://advertiser.example/buy-shoes"
  attributionsourceeventid="123456"
  attributionreportto="https://reporter.example"
  attributeon="https://advertiser.example"
  attributionexpiry=604800000>
  Click me!
</a>
```


TODO: Design for view-through attribution is still TBD, with some initial API surface [here](https://github.com/WICG/conversion-measurement-api/blob/main/AGGREGATE.md#view-through-conversions-1) for aggregate. There is an [open issue](https://github.com/WICG/conversion-measurement-api/issues/98) for support in the event-level API.


### Registering clicks from apps

To register clicks from apps, we can send an ACTION_VIEW Intent with some extra parameters to configure the API. The extra parameters are embedded within a [PendingIntent](https://developer.android.com/reference/android/app/PendingIntent) the browser will self-fire.

```java
// After an ad click, in response to some InputEvent `inputEvent`

// Craft the inner intent which the user's browser will self-fire. Set the
// package of this intent later by querying the default app for the outer intent.

// TODO: which namespace should the APP_ATTRIBUTION type live in?
Intent convIntent = new Intent("android.web.action.APP_ATTRIBUTION");
Bundle innerBundle = new Bundle();
innerBundle.putString("attributionSourceEventId", "123456");
innerBundle.putString("attributionReportTo", "https://reporter.example");
innerBundle.putString("attributeOn", "https://advertiser.example");
innerBundle.putInt("attributionExpiry", 604800000);

// Put the input event that triggered the ad click in the bundle. The browser will
// verify this with the system on Android 11+.
// To be sure that the input event will verify on the browser side, apps could
// pre-verify by calling InputManger.verifyInputEvent here.
innerBundle.putParcelable(inputEvent);
convIntent.putExtras(innerBundle);

// Craft the outer intent which will actually start the browser activity and
// navigate to a URL. This includes the inner intent wrapped as a PendingIntent.
Intent outerIntent = new Intent(Intent.ACTION_VIEW);
outerIntent.setData(Uri.parse("https://advertiser.example/buy-shoes"));

// Check the default browser to ensure the inner intent is sent to the right
// app that would receive the intent by default. Set the package of the inner
// intent.
String packageName = getPackageManager().resolveActivity(
  i, PackageManager.MATCH_DEFAULT_ONLY);
convIntent.setPackage(packageName);
outerIntent.setPackage(packageName);

Bundle outerBundle = new Bundle();
PendingIntent pending = PendingIntent.getActivity(this, 0, convIntent,
  PendingIntent.FLAG_MUTABLE);
outerBundle.putParcelable("android.web.extra.CONVERSION_INTENT", pending);
outerIntent.putExtras(outerBundle);
startActivity(outerIntent);
```



### Registering views from apps

Views won't necessarily start the browser with an intent, so we can use a [ContentProvider](https://developer.android.com/reference/android/content/ContentProvider) to communicate events the browser.

```java
// After an ad view. Parameters for event-level API only.
ContentValues newValues = new ContentValues();
newValues.put("attributionSourceEventId", "123456");
newValues.put("attributionReportTo", "https://reporter.example");
newValues.put("attributeOn", "https://advertiser.example");
newValues.put("attributionExpiry", 604800000);

// Get the default browser to send to.
Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("http://test"));
String packageName = getPackageManager().resolveActivity(
  i, PackageManager.MATCH_DEFAULT_ONLY).activityInfo.packageName;

getContentResolver().insert(
  String.format("content://%s/app-conversions", packageName), newValues);
```



### Unifying events from Webviews with the browser

When the Attribution Reporting API is used in web content within a WebView, it could (via some new opt-in WebView API) internally use these techniques in the background to communicate with the browser and unify events.

However, we cannot directly unify events in WebView "as if" they happened in the browser, due to the fact that Webviews (even the system WebView) are inherently controlled by their embedders.

As such, we cannot trust a WebView to accurately report things like the source origin of an event. For WebView the best we can do without major architectural changes (e.g. cross process rendering) is to attribute events to the embedding APK like any other app.

Any other suggested solutions to this problem are appreciated!

## Computing Origins from Apps

We propose to use [Digital Asset Links](https://developers.google.com/digital-asset-links/v1/getting-started) to reliably compute origins from apps, so that internal API logic can treat APKs just like origins.

Like the [CCT PostMessage API](https://developers.google.cn/web/android/custom-tabs/headers?hl=zh-cn#set_up_digital_asset_links), the browser will look at the `delegate_permission/common.use_as_origin` relation for the app and use that origin directly as the attribution source origin (which will govern things like API rate-limiting).

Attribution for apps without such links will be ignored.


## Privacy considerations

This proposal explicitly links data from app and web contexts, which is a new form of data that the web platform has not had explicit access to before. It enables apps to learn coarse user behavior patterns in the browser in the same way that the existing Attribution Reporting API allows websites to learn coarse user behavior patterns in the browser. In other words, we can safely think of an app as a particular "kind of website", and we can share data to apps that we’d be comfortable sharing to a (cross-site) website.

Additionally, depending on implementation decisions, browsers may add new, temporary storage to collect app events before unifying them with the browser’s collection of events produced by websites. Any new storage should be cleared when the user deletes their site data for the site of any of the source, attributeOn, or reportTo origins.


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

The browser can verify clicks by having an API surface that receives parceled InputEvents in the view intent, and subsequently calling `InputManager.verifyInputEvent(InputEvent)`. This design allows the API to be backward compatible, and verify events on a best-effort basis.

**Note: It is a non-goal to attempt to verify clicks from a compromised system.**


## Appendix


## Scalability with many browsers

In the current API proposal, view messages could be sent to any number of browsers that support the API on the system, which could grow to be difficult to manage.

If this API proves itself to be useful, we could attempt to get platform level support in the future to have a unified interface for cross app attribution measurement.


## References & acknowledgements

Apple has announced a [similar feature](https://webkit.org/blog/11529/introducing-private-click-measurement-pcm/#:~:text=App-to-Web) to support conversions within Safari to be attributed to app clicks on iOS.
