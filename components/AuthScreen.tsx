"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { BookMarked, Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type AuthMode = 'signin' | 'signup' | 'reset';

function translateAuthError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('user already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('unable to validate email')) return 'Informe um endereço de e-mail válido.';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns instantes.';
  return message;
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMsg('');
    setInfoMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Informe seu e-mail.');
      return;
    }

    if (mode !== 'reset' && password.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: name.trim() || cleanEmail.split('@')[0],
            },
          },
        });
        if (error) throw error;

        if (!data.session) {
          setInfoMsg('Conta criada! Verifique seu e-mail para confirmar o cadastro e depois faça login.');
          setMode('signin');
          setPassword('');
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        });
        if (error) throw error;
        setInfoMsg('Enviamos um link de recuperação para o seu e-mail.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar.';
      setErrorMsg(translateAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9F7] text-[#1A1A1A] flex flex-col justify-center px-6 py-12 font-sans">
      <div className="max-w-sm w-full mx-auto">
        {/* Marca */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-10"
        >
          <div className="bg-[#1A1A1A] p-3 rounded-2xl shadow-xl shadow-black/15 mb-4">
            <BookMarked size={24} className="text-white" />
          </div>
          <h1
            className="text-4xl leading-none italic font-serif"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            IB<span className="not-italic font-sans font-light text-stone-400 tracking-tighter">Read</span>
          </h1>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 mt-3">
            Sua estante digital pessoal
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-stone-100 p-8"
        >
          {/* Tabs Entrar / Criar Conta */}
          {mode !== 'reset' ? (
            <div className="flex bg-stone-100/80 p-1 rounded-xl mb-7">
              {([
                { id: 'signin', label: 'Entrar' },
                { id: 'signup', label: 'Criar conta' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchMode(tab.id)}
                  className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    mode === tab.id
                      ? 'bg-white text-[#1A1A1A] shadow-sm'
                      : 'text-stone-400 hover:text-stone-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-1">
                Recuperar acesso
              </p>
              <p className="text-xs text-stone-500">
                Informe seu e-mail para receber o link de redefinição.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-b border-stone-100 py-2">
                    <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 block mb-1.5">
                      Nome
                    </label>
                    <div className="flex items-center gap-2.5">
                      <User size={15} className="text-stone-300 flex-shrink-0" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como quer ser chamado"
                        className="w-full bg-transparent outline-none font-semibold text-sm placeholder:text-stone-300"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* E-mail */}
            <div className="border-b border-stone-100 py-2">
              <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 block mb-1.5">
                E-mail
              </label>
              <div className="flex items-center gap-2.5">
                <Mail size={15} className="text-stone-300 flex-shrink-0" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full bg-transparent outline-none font-semibold text-sm placeholder:text-stone-300"
                />
              </div>
            </div>

            {/* Senha */}
            {mode !== 'reset' && (
              <div className="border-b border-stone-100 py-2">
                <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-400 block mb-1.5">
                  Senha
                </label>
                <div className="flex items-center gap-2.5">
                  <Lock size={15} className="text-stone-300 flex-shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-transparent outline-none font-semibold text-sm placeholder:text-stone-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-stone-300 hover:text-stone-500 transition-colors"
                    aria-label="Mostrar ou ocultar senha"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* Mensagens */}
            {errorMsg && (
              <p className="text-xs font-semibold text-red-500 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                {errorMsg}
              </p>
            )}

            {infoMsg && (
              <div className="flex items-start gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-2.5">
                <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#1A1A1A] text-white py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-black/10 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <>
                  <span>
                    {mode === 'signin'
                      ? 'Entrar na Estante'
                      : mode === 'signup'
                      ? 'Criar Minha Conta'
                      : 'Enviar Link'}
                  </span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Ação secundária */}
          <div className="mt-6 text-center">
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-[11px] font-semibold text-stone-400 hover:text-[#1A1A1A] transition-colors"
              >
                Esqueceu sua senha?
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-[11px] font-semibold text-stone-400 hover:text-[#1A1A1A] transition-colors"
              >
                Voltar para o login
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
