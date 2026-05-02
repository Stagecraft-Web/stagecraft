import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    rules: {
      // Our <Image> wrapper derives alt from the ImageMetadata it receives;
      // it doesn't take a separate alt prop. Don't apply Next's alt-text
      // rule to custom components named "Image" in this codebase.
      "jsx-a11y/alt-text": ["warn", { img: ["img"] }],
    },
  },
];
