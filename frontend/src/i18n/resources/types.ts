export type TranslationShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string
    ? string
    : T[Key] extends Readonly<Record<string, unknown>>
      ? TranslationShape<T[Key]>
      : T[Key];
};
