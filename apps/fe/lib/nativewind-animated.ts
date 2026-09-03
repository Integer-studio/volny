import { Animated } from "react-native";
import { cssInterop } from "nativewind";

// NativeWind v4 only applies `className` to components it has registered
// through cssInterop. `Animated.View`/`Animated.Text` are wrappers created
// by createAnimatedComponent and aren't registered by default, so a
// className on them is silently dropped (no warning, no error) - this bit
// FreeButton's shadow and Reveal's flex-row (see git history on both).
// Importing this module once at the app root fixes every such usage.
cssInterop(Animated.View, { className: "style" });
cssInterop(Animated.Text, { className: "style" });
