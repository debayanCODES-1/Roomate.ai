"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, ChevronDown, Heart, MessageCircle, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import SwipeDeck, { MatchCard } from "@/components/SwipeDeck";
import { MOCK_CARDS, MOCK_USERS } from "@/lib/mock-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== "undefined" && window.location.hostname.endsWith(".app.github.dev")
    ? `${window.location.protocol}//${window.location.host.replace("-3000.", "-8000.")}`
    : "http://localhost:8000"
);

type DemoUser = { id: string; name: string; gender: string; allow_coed_living: boolean };
type ChatMessage = { role: "you" | "roomie"; text: string };
type MatchResult = {
  chat_room_id: string;
  match: { user: { id: string; name: string }; compatibility_report: { icebreakers: string[] } };
};
type ExistingMatch = {
  chat_room_id: string;
  user: { id: string; name: string; age: number; occupation: string };
  compatibility_report: { match_percentage: number; icebreakers: string[] };
};

function readLocalState<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    return fallback;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.detail === "string" ? body.detail : "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return body as T;
}

export default function Home() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [userId, setUserId] = useState("");
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [feedVersion, setFeedVersion] = useState(0);
  const [mockMode, setMockMode] = useState(false);
  const [localSwipes, setLocalSwipes] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "roomie", text: "Hey! Let’s find a home that feels good to come back to." }
  ]);
  const [onboardingText, setOnboardingText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [allowCoed, setAllowCoed] = useState(false);
  const [sandboxGender, setSandboxGender] = useState("woman");
  const [sandboxAge, setSandboxAge] = useState(25);
  const [matches, setMatches] = useState<ExistingMatch[]>([]);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [chatMatch, setChatMatch] = useState<ExistingMatch | MatchResult["match"] | null>(null);
  const [chatText, setChatText] = useState("");
  const [localChat, setLocalChat] = useState<ChatMessage[]>([]);

  useEffect(() => {
    function activatePreview() {
      const previewUser = MOCK_USERS[0];
      setMockMode(true);
      setUsers(MOCK_USERS);
      setUserId(previewUser.id);
      setSandboxGender(previewUser.gender);
      setAllowCoed(previewUser.allow_coed_living);
      setLocalSwipes(readLocalState(`roomie:swipes:${previewUser.id}`, {}));
      setMatches(readLocalState(`roomie:matches:${previewUser.id}`, []));
      setNotice("Interactive preview mode is on. Swipes and matches are saved in this browser.");
    }

    api<DemoUser[]>("/api/demo/users")
      .then((list) => {
        if (list.length === 0) {
          activatePreview();
          return;
        }
        setUsers(list);
        if (list.length) {
          setUserId(list[0].id);
          setSandboxGender(list[0].gender);
          setAllowCoed(list[0].allow_coed_living);
        }
      })
      .catch(() => activatePreview());
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (mockMode) {
      let active = true;
      Promise.resolve().then(() => {
        if (!active) return;
        const currentUser = users.find((user) => user.id === userId);
        const swipes = readLocalState<Record<string, boolean>>(`roomie:swipes:${userId}`, {});
        setLocalSwipes(swipes);
        setCards(MOCK_CARDS.filter((candidate) => {
          const genderAllowed = candidate.gender === currentUser?.gender
            || (allowCoed && currentUser?.allow_coed_living && candidate.allow_coed_living);
          return genderAllowed && swipes[candidate.id] === undefined;
        }));
        setMatches(readLocalState(`roomie:matches:${userId}`, []));
      });
      return () => { active = false; };
    }

    let active = true;
    Promise.all([
      api<{ cards: MatchCard[] }>(`/api/feed/${userId}`),
      api<{ matches: ExistingMatch[] }>(`/api/matches/${userId}`)
    ]).then(([feed, matchList]) => {
      if (active) {
        if (feed.cards.length === 0) {
          setMockMode(true);
          setUsers(MOCK_USERS);
          setUserId(MOCK_USERS[0].id);
          setNotice("No roommate profiles are available from the API yet, so interactive preview profiles are shown.");
          return;
        }
        setCards(feed.cards);
        setMatches(matchList.matches);
      }
    }).catch((cause: Error) => {
      if (active) {
        setMockMode(true);
        setUsers(MOCK_USERS);
        setUserId(MOCK_USERS[0].id);
        setAllowCoed(MOCK_USERS[0].allow_coed_living);
        setLocalSwipes(readLocalState(`roomie:swipes:${MOCK_USERS[0].id}`, {}));
        setMatches(readLocalState(`roomie:matches:${MOCK_USERS[0].id}`, []));
        setNotice("The API is unavailable. Interactive preview profiles are ready, with activity saved in this browser.");
      }
    });
    return () => { active = false; };
  }, [userId, feedVersion, mockMode, allowCoed, users]);

  async function handleSwipe(card: MatchCard, liked: boolean) {
    if (!userId) return;
    setError("");
    if (mockMode) {
      const savedSwipes = readLocalState<Record<string, boolean>>(`roomie:swipes:${userId}`, localSwipes);
      const nextSwipes = { ...savedSwipes, [card.id]: liked };
      setLocalSwipes(nextSwipes);
      window.localStorage.setItem(`roomie:swipes:${userId}`, JSON.stringify(nextSwipes));
      if (liked && card.mockMutual) {
        const localMatch: ExistingMatch = {
          chat_room_id: `local-match-${card.id}`,
          user: { id: card.id, name: card.name, age: card.age ?? 0, occupation: card.occupation },
          compatibility_report: { match_percentage: card.match_percentage, icebreakers: card.icebreakers }
        };
        const nextMatches = [localMatch, ...matches.filter((match) => match.chat_room_id !== localMatch.chat_room_id)];
        setMatches(nextMatches);
        window.localStorage.setItem(`roomie:matches:${userId}`, JSON.stringify(nextMatches));
        setMatchResult({
          chat_room_id: localMatch.chat_room_id,
          match: { user: { id: card.id, name: card.name }, compatibility_report: { icebreakers: card.icebreakers } }
        });
      } else if (liked) {
        setNotice(`Like sent to ${card.name}. Keep exploring your preview matches.`);
      }
      return;
    }

    try {
      const result = await api<{
        is_mutual_match: boolean;
        chat_room_id: string | null;
        match: MatchResult["match"] | null;
      }>("/api/swipe", {
        method: "POST",
        body: JSON.stringify({ swiper_id: userId, candidate_id: card.id, liked })
      });
      if (result.is_mutual_match && result.chat_room_id && result.match) {
        setMatchResult({ chat_room_id: result.chat_room_id, match: result.match });
        setMatches((current) => [{
          chat_room_id: result.chat_room_id!,
          user: { id: card.id, name: card.name, age: card.age || 0, occupation: card.occupation },
          compatibility_report: { match_percentage: card.match_percentage, icebreakers: result.match!.compatibility_report.icebreakers }
        }, ...current]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your swipe.");
    }
  }

  async function submitOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onboardingText.trim() || !userId) return;
    const text = onboardingText.trim();
    setBusy(true);
    setError("");
    setMessages((current) => [...current, { role: "you", text }]);
    setOnboardingText("");
    if (mockMode) {
      setMessages((current) => [...current, {
        role: "roomie",
        text: "Got it — your preview profile is updated. I’ll use your routine, cleanliness, and food preferences to guide the matches."
      }]);
      setNotice("Your preview profile has been updated.");
      setBusy(false);
      return;
    }

    try {
      const result = await api<{ assistant_reply: string }>("/api/onboard/chat", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, message: text })
      });
      setMessages((current) => [...current, { role: "roomie", text: result.assistant_reply }]);
      setNotice("Your roommate profile is updated.");
      setFeedVersion((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function verifySandbox() {
    if (!userId) return;
    if (mockMode) {
      setNotice("Preview verification complete. This is a local demo and does not verify a real identity.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/kyc/verify", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          authorization_code: `sandbox-${crypto.randomUUID()}`,
          sandbox_gender: sandboxGender,
          sandbox_age: sandboxAge
        })
      });
      setNotice("Sandbox identity check complete. Only verified gender and age are retained.");
      setFeedVersion((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCoedPreference(next: boolean) {
    setAllowCoed(next);
    if (!userId) return;
    if (mockMode) {
      setUsers((current) => current.map((user) => user.id === userId
        ? { ...user, allow_coed_living: next }
        : user));
      setNotice(next
        ? "Co-ed preview is on. Cross-gender profiles appear only when both sides opt in."
        : "Co-ed preview is off. You’ll only see same-gender profiles.");
      return;
    }
    setError("");
    try {
      await api(`/api/preferences/${userId}`, {
        method: "PUT",
        body: JSON.stringify({
          allow_coed_living: next,
          min_rent_budget: 10000,
          max_rent_budget: 18000,
          deposit_budget: 40000,
          utilities_share: true,
          commute_location: "Bengaluru",
          max_commute_km: 15
        })
      });
      setFeedVersion((value) => value + 1);
    } catch (cause) {
      setAllowCoed(!next);
      setError(cause instanceof Error ? cause.message : "Could not save preferences.");
    }
  }

  async function openMatches() {
    if (!userId) return;
    if (mockMode) {
      setMatches(readLocalState(`roomie:matches:${userId}`, []));
      setMatchesOpen(true);
      return;
    }
    try {
      const result = await api<{ matches: ExistingMatch[] }>(`/api/matches/${userId}`);
      setMatches(result.matches);
      setMatchesOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load matches.");
    }
  }

  function sendLocalChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chatText.trim()) return;
    setLocalChat((current) => [...current, { role: "you", text: chatText.trim() }]);
    setChatText("");
  }

  function resetPreview() {
    if (!userId) return;
    window.localStorage.removeItem(`roomie:swipes:${userId}`);
    window.localStorage.removeItem(`roomie:matches:${userId}`);
    setLocalSwipes({});
    setMatches([]);
    setFeedVersion((version) => version + 1);
    setNotice("Preview profiles reset. You can swipe through them again.");
  }

  const selectedUser = users.find((user) => user.id === userId);

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="#" className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-citrus"><Heart size={19} fill="currentColor" /></span>
          roomie<span className="text-forest">.</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={openMatches} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-ink/70 hover:bg-white">
            <MessageCircle size={17} /> <span className="hidden sm:inline">My matches</span>
            {matches.length > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-citrus px-1 text-[10px] font-bold">{matches.length}</span>}
          </button>
          <label className="relative flex items-center rounded-full border border-ink/10 bg-white px-3 py-2 text-sm">
            <span className="sr-only">Choose demo profile</span>
            <select
              value={userId}
              onChange={(event) => {
                const next = users.find((user) => user.id === event.target.value);
                setUserId(event.target.value);
                setError("");
                if (next) {
                  setSandboxGender(next.gender);
                  setAllowCoed(next.allow_coed_living);
                }
              }}
              className="max-w-[125px] appearance-none bg-transparent pr-5 font-semibold outline-none sm:max-w-none"
            >
              {users.map((user) => <option value={user.id} key={user.id}>As {user.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3" />
          </label>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-14 lg:pt-12">
        <div className="lg:pt-6">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-forest">
            <span className={`h-2 w-2 rounded-full ${mockMode ? "bg-amber-400" : "bg-emerald-500"}`} />
            {mockMode ? "INTERACTIVE PREVIEW · MOCK PROFILES" : "THOUGHTFUL MATCHES, SAFER HOMES"}
          </div>
          <h1 className="max-w-2xl text-5xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl">
            Find your kind<br className="hidden sm:block" /> of <span className="font-serif italic text-forest">home.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink/60">
            More than a good location. Meet verified people whose routines, budgets, and idea of a happy home fit yours.
          </p>

          {error && <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
          {notice && <div role="status" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-ink/5 bg-white/75 p-4 shadow-sm">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-sage text-forest"><ShieldCheck size={21} /></div>
            <div className="min-w-[180px] flex-1">
              <p className="text-sm font-semibold">Verified people, first</p>
              <p className="mt-0.5 text-xs leading-5 text-ink/55">Every profile in your feed passes identity and preference checks.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink/70">
              <input
                type="checkbox"
                checked={allowCoed}
                onChange={(event) => saveCoedPreference(event.target.checked)}
                className="h-4 w-4 accent-forest"
              />
              Open to co-ed
            </label>
          </div>

          <div className="mt-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest/60">A better kind of roommate search</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">Your people, in your place.</h2>
              </div>
              <span className="hidden items-center gap-1.5 text-xs text-ink/45 sm:flex"><Users size={15} /> Verified community</span>
            </div>
            <SwipeDeck
              key={`${userId}-${feedVersion}-${mockMode}-${allowCoed}`}
              cards={cards}
              onSwipe={handleSwipe}
              onReset={mockMode ? resetPreview : undefined}
            />
            {cards.length > 0 && (
              <button
                onClick={() => setFeedVersion((version) => version + 1)}
                className="mx-auto mt-3 block text-xs font-semibold text-forest underline decoration-forest/30 underline-offset-4"
              >
                Refresh roommate feed
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-5 lg:pt-4">
          <section className="overflow-hidden rounded-[1.75rem] border border-ink/5 bg-white shadow-sm">
            <div className="flex items-start justify-between border-b border-ink/5 p-5">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-forest">
                  <Sparkles size={15} /> Your roommate profile
                </p>
                <h2 className="mt-2 text-xl font-semibold">Tell us how you live.</h2>
              </div>
              <span className="rounded-full bg-sage px-2.5 py-1 text-[10px] font-bold text-forest">AI GUIDED</span>
            </div>
            <div className="max-h-[235px] space-y-3 overflow-y-auto p-5">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "you" ? "justify-end" : "justify-start"}`}>
                  <p className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${message.role === "you" ? "rounded-br-sm bg-forest text-white" : "rounded-bl-sm bg-paper text-ink/75"}`}>
                    {message.text}
                  </p>
                </div>
              ))}
              {busy && <p className="text-xs text-ink/45">Updating your profile…</p>}
            </div>
            <form onSubmit={submitOnboarding} className="flex gap-2 border-t border-ink/5 p-4">
              <input
                value={onboardingText}
                onChange={(event) => setOnboardingText(event.target.value)}
                placeholder="e.g. Early riser, WFH, vegetarian…"
                maxLength={4000}
                className="min-w-0 flex-1 rounded-xl bg-paper px-3.5 py-3 text-sm outline-none ring-forest/20 placeholder:text-ink/35 focus:ring-2"
              />
              <button disabled={busy || !onboardingText.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest text-white disabled:opacity-40">
                <Sparkles size={17} />
                <span className="sr-only">Send profile details</span>
              </button>
            </form>
          </section>

          <section className="rounded-[1.75rem] border border-ink/5 bg-[#eaf0e9] p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700"><ShieldCheck size={20} /></div>
              <div className="flex-1">
                <h2 className="font-semibold">Identity verification</h2>
                <p className="mt-1 text-xs leading-5 text-ink/60">
                  {selectedUser ? `Demo profile: ${selectedUser.name}.` : "Choose a profile to continue."} The sandbox never asks for or stores Aadhaar numbers.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_80px] gap-2">
              <label className="relative">
                <span className="sr-only">Verified gender simulation</span>
                <select value={sandboxGender} onChange={(event) => setSandboxGender(event.target.value)} className="h-10 w-full appearance-none rounded-xl border border-forest/10 bg-white px-3 pr-8 text-xs font-medium outline-none">
                  <option value="woman">Woman</option>
                  <option value="man">Man</option>
                  <option value="non_binary">Non-binary</option>
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-3 top-3.5" />
              </label>
              <input aria-label="Verified age simulation" type="number" min={18} max={100} value={sandboxAge} onChange={(event) => setSandboxAge(Number(event.target.value))} className="h-10 rounded-xl border border-forest/10 bg-white px-3 text-xs outline-none" />
            </div>
            <button onClick={verifySandbox} disabled={busy || !userId} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#244b39] disabled:opacity-50">
              <Check size={16} /> Run sandbox verification
            </button>
            <p className="mt-2 text-center text-[10px] text-ink/45">Production OAuth must be configured with a supported KYC provider.</p>
          </section>

          <div className="rounded-2xl border border-ink/5 bg-white/65 p-4 text-xs leading-5 text-ink/55">
            <strong className="text-ink/75">A note on matching.</strong> Verified gender is a strict eligibility rule. Co-ed matches are considered only when both people opt in.
          </div>
        </aside>
      </section>

      {matchResult && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-2xl">
            <button onClick={() => setMatchResult(null)} aria-label="Close match dialog" className="absolute right-4 top-4 rounded-full p-2 text-ink/50 hover:bg-paper"><X size={18} /></button>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-citrus text-forest"><Heart size={28} fill="currentColor" /></div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-forest">It’s mutual</p>
            <h2 className="mt-2 text-3xl font-semibold">You and {matchResult.match.user.name} clicked.</h2>
            <p className="mt-3 text-sm leading-6 text-ink/60">Your private chat room is ready. Here are a couple of easy ways to start.</p>
            <div className="mt-5 space-y-2 text-left">
              {matchResult.match.compatibility_report.icebreakers.map((icebreaker) => <p key={icebreaker} className="rounded-xl bg-paper p-3 text-sm text-ink/75">“{icebreaker}”</p>)}
            </div>
            <button
              onClick={() => {
                setChatMatch(matchResult.match);
                setLocalChat([]);
                setMatchResult(null);
              }}
              className="mt-5 w-full rounded-xl bg-forest py-3 text-sm font-semibold text-white"
            >
              Open chat <MessageCircle className="ml-1 inline" size={16} />
            </button>
          </div>
        </div>
      )}

      {chatMatch && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onMouseDown={(event) => { if (event.target === event.currentTarget) setChatMatch(null); }}>
          <aside role="dialog" aria-modal="true" className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink/10 p-5">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-forest">Your private room</p><h2 className="mt-1 text-lg font-semibold">Chat with {chatMatch.user.name}</h2></div>
              <button onClick={() => setChatMatch(null)} aria-label="Close chat drawer" className="rounded-full p-2 hover:bg-paper"><X size={19} /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-paper/60 p-5">
              <p className="mx-auto max-w-xs rounded-2xl bg-white p-4 text-center text-sm leading-6 text-ink/65 shadow-sm">
                Start with a shared topic. No contact details are revealed until you choose to share them.
              </p>
              {"compatibility_report" in chatMatch && chatMatch.compatibility_report.icebreakers.map((icebreaker) => (
                <button key={icebreaker} onClick={() => setLocalChat((current) => [...current, { role: "you", text: icebreaker }])} className="block rounded-full border border-forest/15 bg-white px-3.5 py-2 text-left text-xs text-forest hover:bg-sage">
                  {icebreaker}
                </button>
              ))}
              {localChat.map((message, index) => <p key={index} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-forest px-4 py-2.5 text-sm text-white">{message.text}</p>)}
            </div>
            <form onSubmit={sendLocalChat} className="flex gap-2 border-t border-ink/10 p-4">
              <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Write a message…" className="min-w-0 flex-1 rounded-full bg-paper px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-forest/20" />
              <button className="rounded-full bg-forest px-5 text-sm font-semibold text-white">Send</button>
            </form>
          </aside>
        </div>
      )}

      {matchesOpen && !chatMatch && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onMouseDown={(event) => { if (event.target === event.currentTarget) setMatchesOpen(false); }}>
          <aside role="dialog" aria-modal="true" className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink/10 p-5">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-forest">Mutual connections</p><h2 className="mt-1 text-lg font-semibold">Your matches</h2></div>
              <button onClick={() => setMatchesOpen(false)} aria-label="Close matches" className="rounded-full p-2 hover:bg-paper"><X size={19} /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {matches.length === 0 && <p className="rounded-2xl bg-paper p-5 text-sm leading-6 text-ink/60">No mutual matches just yet. Keep exploring verified profiles.</p>}
              {matches.map((match) => (
                <button
                  key={match.chat_room_id}
                  onClick={() => { setChatMatch(match); setMatchesOpen(false); setLocalChat([]); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-ink/5 p-4 text-left transition hover:border-forest/20 hover:bg-sage/50"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-citrus font-bold text-forest">{match.user.name[0]}</span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{match.user.name}</span><span className="mt-1 block truncate text-xs text-ink/55">{match.user.occupation}</span></span>
                  <MessageCircle size={17} className="text-forest" />
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
      {chatMatch === null && matches.length > 0 && (
        <button onClick={openMatches} className="fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full bg-forest text-white shadow-xl" aria-label="Open matches">
          <MessageCircle size={20} />
        </button>
      )}
      {!userId && !error && <div className="fixed inset-0 z-40 grid place-items-center bg-paper/80 text-sm text-ink/60">Loading roommate profiles…</div>}
    </main>
  );
}
