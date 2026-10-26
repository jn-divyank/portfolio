# WebView finds bridge methods by reflection and checks for the annotation at runtime.
-keepattributes *Annotation*
-keepclassmembers class io.github.jndivyank.ritual.MainActivity$Bridge {
    @android.webkit.JavascriptInterface public *;
}
