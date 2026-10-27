# Archive: the 2015 Processing sketch

`noEternity/` is the original source of the artwork, written in [Processing](https://processing.org) in 2015 and released at the time as an Android app. It is kept for reference only. The website in the root of this repository replaces it and doesn't use any of these files.

- `noEternity.pde`: the main sketch, which paints rows of translucent circles where you touch.
- `CLASS.pde`: the blur-and-black-squares "dissolve" effect.
- `data/`: the bitmap fonts the sketch used for its title.
- `icon.png`, `Untitled-2.png`, `Untitled-2.jpg`: the app icon and promotional art. The website's icons are made from `icon.png`.

## The sensor version

An earlier version was driven by four Arduino sensors over a serial port. The Android app shipped with that code commented out, which is why the dissolve effect never ran there. This is the code, from the Android export:

```java
void serialEvent(Serial myPort) {
  String myString = myPort.readStringUntil('*');
  if (myString != null) {
    int[] sensors = int(splitTokens(myString, ",*"));
    firstvalue  = map(sensors[0], 0, 1023, 0, width);
    secondvalue = map(sensors[1], 0, 1023, 0, height);
    thirdvalue  = sensors[2];   // > 0 runs CLASS.display()
    fourthvalue = sensors[3];   // > 0 runs CLASS.display()
  }
}
```

The website gives the dissolve back to visitors as the ◐ button and the space bar.

## Removed Android files

The Android project files (`AndroidManifest.xml`, the generated build in `bin/` and the signing keystore `noEternity.bks`) were removed when the project became a website. They are still in the git history: `git show c05db23:noEternity/noEternity.bks > noEternity.bks` restores the keystore, for example.
