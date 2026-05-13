/// <reference types="nativewind/types" />

import type { ViewProps, TextProps, TextInputProps, ScrollViewProps, KeyboardAvoidingViewProps, ActivityIndicatorProps, TouchableOpacityProps, ImageProps } from 'react-native';

declare module 'react-native' {
    interface ViewProps { className?: string; }
    interface TextProps { className?: string; }
    interface TextInputProps { className?: string; }
    interface ScrollViewProps { className?: string; }
    interface KeyboardAvoidingViewProps { className?: string; }
    interface ActivityIndicatorProps { className?: string; }
    interface TouchableOpacityProps { className?: string; }
    interface ImageProps { className?: string; }
}

declare module '*.tsx' {
    const content: any;
    export default content;
}
