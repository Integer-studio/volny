import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from "react-native";
import { api, ApiError, isServerUnavailable, RegisteredButLoginFailedError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../components/Toast";
import FormField from "../components/FormField";
import { fieldError as getFieldError, errorMessage } from "../lib/errors";
import { useSlowActionNotice } from "../hooks/useSlowActionNotice";

function validatePasswordLocal(v: string): string | null {
  return v.length < 4 ? "Heslo musí mít alespoň 4 znaky." : null;
}

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const { show } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  // Studený backend: po 4 s toast "server se probouzí", ať tlačítko
  // se spinnerem nevypadá jako zaseknuté.
  useSlowActionNotice(loading);

  useEffect(() => {
    if (isLogin || username.trim().length === 0) {
      setUsernameTaken(false);
      return;
    }
    let cancelled = false;
    const debounce = setTimeout(async () => {
      // Chyba kontroly (server spí, rate limit) = nic nehlásit, rozhodne
      // až registrace sama (409).
      const available = await api
        .isUsernameAvailable(username.trim())
        .catch(() => true);
      if (!cancelled) setUsernameTaken(!available);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [username, isLogin]);

  const handleSubmit = async () => {
    if (loading) return; // Enter během běžícího přihlášení
    setNameError(null);
    setUsernameError(null);
    setPasswordError(null);

    if (!isLogin) {
      const localPasswordError = validatePasswordLocal(password);
      if (localPasswordError) {
        setPasswordError(localPasswordError);
        return;
      }
    }
    if (!username || !password || (!isLogin && !name)) {
      show("Vyplň všechna pole.", "error");
      return;
    }
    if (!isLogin && usernameTaken) {
      setUsernameError("Toto uživatelské jméno je už obsazené.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(username, password);
      } else {
        // Telefon a Instagram se ptá až průvodce po registraci (app/onboarding.tsx).
        await signUp(username, password, name);
      }
    } catch (e) {
      if (e instanceof RegisteredButLoginFailedError) {
        // Účet existuje - další "Zaregistrovat" by skončil 409 "jméno je
        // obsazené" na vlastní účet. Přepnout na přihlášení s vyplněnými poli.
        setIsLogin(true);
        show("Účet je vytvořený, přihlas se.", "success");
      } else if (isServerUnavailable(e)) {
        // Síť, timeout i 502/503/504 ze studeného nebo padlého serveru.
        show("Server teď neodpovídá. Zkus to prosím za chvíli znovu.", "error");
      } else if (e instanceof ApiError && e.status === 409) {
        setUsernameError(
          "Toto uživatelské jméno je už obsazené. Zvol si prosím jiné.",
        );
      } else if (e instanceof ApiError && e.status === 401) {
        show("Nesprávné jméno nebo heslo.", "error");
      } else if (e instanceof ApiError && e.status === 400) {
        const nameErr = getFieldError(e, "name");
        const usernameErr = getFieldError(e, "username");
        const passwordErr = getFieldError(e, "password");
        if (nameErr) setNameError(nameErr);
        if (usernameErr) setUsernameError(usernameErr);
        if (passwordErr) setPasswordError(passwordErr);
        if (!nameErr && !usernameErr && !passwordErr) {
          show(
            errorMessage(e, "Nepodařilo se přihlásit. Zkus to prosím znovu."),
            "error",
          );
        }
      } else {
        show("Nepodařilo se přihlásit. Zkus to prosím znovu.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    // Na malém telefonu by klávesnice překryla "Zaregistrovat" - formulář
    // se posouvá a odsouvá nad ni.
    <KeyboardAvoidingView
      className="flex-1 bg-[#FCFBF8]"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        contentContainerClassName="px-8 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-4xl font-bold text-[#EE6C4D] mb-2">
          {isLogin ? "Vítej zpět" : "Nová registrace"}
        </Text>
        <Text className="text-gray-500 mb-8">
          {isLogin
            ? "Přihlas se ke svému účtu."
            : "Vytvoř si nový účet pro Volný."}
        </Text>

        {!isLogin && (
          <FormField
            label="Celé jméno (zobrazované)"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => usernameRef.current?.focus()}
            error={nameError}
          />
        )}

        <FormField
          ref={usernameRef}
          label="Uživatelské jméno"
          hint={isLogin ? undefined : "Tímto jménem se budeš přihlašovat."}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          autoComplete="username"
          textContentType="username"
          error={
            !isLogin && usernameTaken
              ? "Toto uživatelské jméno je už obsazené."
              : usernameError
          }
        />

        <FormField
          ref={passwordRef}
          label="Heslo"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isLogin ? "current-password" : "new-password"}
          textContentType={isLogin ? "password" : "newPassword"}
          error={passwordError}
        />

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className={`bg-[#EE6C4D] py-4 rounded-xl items-center shadow-lg shadow-[#EE6C4D]/30 active:opacity-80 mt-2 ${loading ? "opacity-60" : ""}`}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-lg">
              {isLogin ? "Přihlásit se" : "Zaregistrovat"}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            setIsLogin(!isLogin);
            setNameError(null);
            setUsernameError(null);
            setPasswordError(null);
          }}
          accessibilityRole="button"
          className="mt-6 items-center p-2"
        >
          <Text className="text-gray-500">
            {isLogin ? "Nemáš účet? " : "Už máš účet? "}
            <Text className="text-[#EE6C4D] font-bold">
              {isLogin ? "Zaregistruj se" : "Přihlas se"}
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
