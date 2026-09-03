module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset"), require("./nativecn-preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
