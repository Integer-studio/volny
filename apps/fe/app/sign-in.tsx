import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useToast } from '../components/Toast';
import FormField from '../components/FormField';
import { fieldError as getFieldError, errorMessage } from '../lib/errors';

function validatePasswordLocal(v: string): string | null {
  return v.length < 4 ? 'Heslo musí mít alespoň 4 znaky.' : null;
}

export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const { show } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (isLogin || username.trim().length === 0) {
      setUsernameTaken(false);
      return;
    }
    const debounce = setTimeout(async () => {
      const users = await api.searchUsers(username).catch(() => []);
      setUsernameTaken(users.some(u => u.username.toLowerCase() === username.toLowerCase()));
    }, 500);
    return () => clearTimeout(debounce);
  }, [username, isLogin]);

  const handleSubmit = async () => {
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
      show('Vyplň všechna pole.', 'error');
      return;
    }
    if (!isLogin && usernameTaken) {
      setUsernameError('Toto uživatelské jméno je již zabrané.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(username, password);
      } else {
        await signUp(username, password, name);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setUsernameError('Toto uživatelské jméno je již zabrané. Zvol si prosím jiné.');
      } else if (e instanceof ApiError && e.status === 401) {
        show('Nesprávné jméno nebo heslo.', 'error');
      } else if (e instanceof ApiError && e.status === 400) {
        const nameErr = getFieldError(e, 'name');
        const usernameErr = getFieldError(e, 'username');
        const passwordErr = getFieldError(e, 'password');
        if (nameErr) setNameError(nameErr);
        if (usernameErr) setUsernameError(usernameErr);
        if (passwordErr) setPasswordError(passwordErr);
        if (!nameErr && !usernameErr && !passwordErr) {
          show(errorMessage(e, 'Nepodařilo se přihlásit. Zkus to prosím znovu.'), 'error');
        }
      } else if (!(e instanceof ApiError)) {
        // Every network-level failure (fetch TypeError, AbortError from the
        // request timeout, ...) lands here since it never became an
        // ApiError. Without this branch it fell into the generic "wrong
        // credentials"-sounding message below, indistinguishable from a
        // real auth failure - see the APK login bug this was written for.
        show('Nepodařilo se spojit se serverem.', 'error');
      } else {
        show('Nepodařilo se přihlásit. Zkus to prosím znovu.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#FCFBF8] justify-center px-8">
      <Text className="text-4xl font-bold text-[#EE6C4D] mb-2">{isLogin ? 'Vítej zpět' : 'Nová registrace'}</Text>
      <Text className="text-gray-500 mb-8">{isLogin ? 'Přihlas se ke svému účtu.' : 'Vytvoř si nový účet pro FreeTime.'}</Text>

      {!isLogin && (
        <FormField
          label="Celé jméno (zobrazované)"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={nameError}
        />
      )}

      <FormField
        label="Uživatelské jméno"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
        textContentType="username"
        error={!isLogin && usernameTaken ? 'Uživatelské jméno je zabrané.' : usernameError}
      />

      <FormField
        label="Heslo"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        textContentType={isLogin ? 'password' : 'newPassword'}
        error={passwordError}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={loading}
        className={`bg-[#EE6C4D] py-4 rounded-xl items-center shadow-lg shadow-[#EE6C4D]/30 active:opacity-80 mt-2 ${loading ? 'opacity-60' : ''}`}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">{isLogin ? 'Přihlásit se' : 'Zaregistrovat'}</Text>}
      </Pressable>

      <Pressable
        onPress={() => { setIsLogin(!isLogin); setNameError(null); setUsernameError(null); setPasswordError(null); }}
        className="mt-6 items-center p-2"
      >
        <Text className="text-gray-500">
          {isLogin ? 'Nemáš účet? ' : 'Už máš účet? '}
          <Text className="text-[#EE6C4D] font-bold">{isLogin ? 'Zaregistruj se' : 'Přihlas se'}</Text>
        </Text>
      </Pressable>
    </View>
  );
}
