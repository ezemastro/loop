/**
 * Spread on the rounded wrapper around a `TextInput` (search bar, amount, ...):
 * `<View {...fieldWrapperProps}>`.
 *
 * react-native-web renders `dataSet` as `data-field`, which `global.css` uses to draw the focus
 * ring around the wrapper (`:focus-within`) instead of a rectangle on the nested input. It is
 * ignored on native. It is a spread rather than an inline prop because `dataSet` is not part of
 * React Native's `ViewProps` typings.
 */
export const fieldWrapperProps = { dataSet: { field: "true" } };
