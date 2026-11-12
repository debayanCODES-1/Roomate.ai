"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Check, ChevronDown, Heart, MapPin, ShieldCheck, Sparkles, X } from "lucide-react";

export type MatchCard = {
  id: string;
  name: string;
  age: number | null;
  gender?: string;
  allow_coed_living?: boolean;
  mockMutual?: boolean;
  occupation: string;
  is_kyc_verified: boolean;
  profile: Record<string, string>;
  max_rent_budget: number;
  commute_location: string;
  match_percentage: number;
  green_flags: string[];
  potential_friction: string[];
  icebreakers: string[];
};

type Props = {
  cards: MatchCard[];
  onSwipe: (card: MatchCard, liked: boolean) => void;
  onReset?: () => void;
};

const money = (value: number) => `₹${new Intl.NumberFormat("en-IN").format(value)}`;

export default function SwipeDeck({ cards, onSwipe, onReset }: Props) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const nopeOpacity = useTransform(x, [-130, -40], [1, 0]);
  const likeOpacity = useTransform(x, [40, 130], [0, 1]);
  const card = cards[index];

  function decide(liked: boolean) {
    if (!card) return;
    onSwipe(card, liked);
    setIndex((current) => current + 1);
    setExpanded(false);
    x.set(0);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      event.preventDefault();
      decide(event.key === "ArrowRight");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!card) {
    return (
      <div className="flex min-h-[510px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-forest/20 bg-white/70 p-10 text-center">
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-sage text-forest">
          <Sparkles size={27} />
        </div>
        <h2 className="text-2xl font-semibold">You’re all caught up</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-ink/60">
          {onReset
            ? "You’ve seen everyone in this preview. Start over to swipe through the profiles again."
            : "There are no profiles in your feed right now. Check back as more roommates join."}
        </p>
        {onReset && (
          <button type="button" onClick={onReset} className="mt-6 rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244b39]">
            Show profiles again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[470px]">
      <div className="relative min-h-[600px]">
        <AnimatePresence mode="wait">
          <motion.article
            key={card.id}
            style={{ x, rotate }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.78}
            onDragEnd={(_, info) => {
              if (info.offset.x > 120 || info.velocity.x > 600) decide(true);
              else if (info.offset.x < -120 || info.velocity.x < -600) decide(false);
            }}
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 260, rotate: 12, transition: { duration: 0.2 } }}
            className="absolute inset-0 cursor-grab overflow-y-auto rounded-[2rem] border border-ink/5 bg-white shadow-card active:cursor-grabbing"
          >
            <div className="relative h-[260px] overflow-hidden bg-[#dce7dc]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,#f8f3da_0,transparent_24%),radial-gradient(circle_at_78%_72%,#a7c7ae_0,transparent_38%),linear-gradient(145deg,#dce7dc,#b8cfbd)]" />
              <div className="absolute -bottom-12 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full border-[22px] border-white/25 bg-forest/10" />
              <div className="absolute inset-x-7 top-6 flex justify-between">
                <span className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold tracking-wide text-forest backdrop-blur">
                  ROOMMATE PROFILE
                </span>
                <motion.span
                  style={{ opacity: nopeOpacity }}
                  className="rounded-lg border-2 border-rose-500 px-3 py-1 text-sm font-bold uppercase text-rose-600"
                >
                  Pass
                </motion.span>
                <motion.span
                  style={{ opacity: likeOpacity }}
                  className="rounded-lg border-2 border-forest px-3 py-1 text-sm font-bold uppercase text-forest"
                >
                  Like
                </motion.span>
              </div>
              <div className="absolute bottom-5 left-7 flex items-end gap-3">
                <div className="grid h-[74px] w-[74px] place-items-center rounded-2xl border-4 border-white bg-citrus text-3xl font-semibold text-forest shadow-lg">
                  {card.name.slice(0, 1)}
                </div>
                <div className="mb-1">
                  <h2 className="text-3xl font-semibold tracking-tight text-ink">
                    {card.name}{card.age ? `, ${card.age}` : ""}
                  </h2>
                  <p className="mt-1 flex items-center gap-1 text-sm text-ink/65">
                    <MapPin size={14} /> {card.commute_location || "Location not shared"}
                  </p>
                </div>
              </div>
              <div className="absolute right-5 top-[72px] flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-2 text-sm font-bold text-white shadow-lg">
                <Sparkles size={15} /> {card.match_percentage}% match
              </div>
            </div>

            <div className="p-6 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{card.occupation}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <ShieldCheck size={15} fill="currentColor" className="text-emerald-600" />
                    <span className="text-emerald-700">
                      {card.is_kyc_verified
                        ? (card.id.startsWith("mock-") ? "Demo verified" : "Identity verified")
                        : "Not verified"}
                    </span>
                  </p>
                </div>
                <div className="rounded-xl bg-sage px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-forest/65">Max rent</p>
                  <p className="text-sm font-bold text-forest">{money(card.max_rent_budget)}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill>Sleeps {card.profile.sleep_time || "flexibly"}</Pill>
                <Pill>{card.profile.work_mode?.toUpperCase() || "Flexible schedule"}</Pill>
                <Pill>{formatFood(card.profile.food)}</Pill>
                <Pill>{formatCleaning(card.profile.cleaning_frequency)}</Pill>
              </div>

              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setExpanded((value) => !value)}
                className="mt-6 flex w-full items-center justify-between border-t border-ink/10 pt-4 text-left text-sm font-semibold"
                aria-expanded={expanded}
              >
                <span className="flex items-center gap-2"><Sparkles size={16} className="text-forest" /> Deep AI compatibility report</span>
                <ChevronDown size={17} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <div className="mt-4 space-y-4 pb-1">
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-forest">Green flags</h3>
                    <ul className="space-y-2">
                      {card.green_flags.map((flag) => (
                        <li key={flag} className="flex gap-2 text-sm leading-5 text-ink/75">
                          <Check size={16} className="mt-0.5 shrink-0 text-emerald-700" />{flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">Worth discussing</h3>
                    <ul className="space-y-2">
                      {card.potential_friction.map((point) => (
                        <li key={point} className="flex gap-2 text-sm leading-5 text-ink/75">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center justify-center gap-5">
        <button
          type="button"
          aria-label="Pass on profile"
          onClick={() => decide(false)}
          className="grid h-14 w-14 place-items-center rounded-full border border-ink/10 bg-white text-rose-500 shadow-md transition hover:-translate-y-1 hover:shadow-lg"
        >
          <X size={25} />
        </button>
        <span className="text-xs font-medium text-ink/45">Drag a card to decide</span>
        <button
          type="button"
          aria-label="Like profile"
          onClick={() => decide(true)}
          className="grid h-14 w-14 place-items-center rounded-full bg-forest text-white shadow-md transition hover:-translate-y-1 hover:bg-[#244b39] hover:shadow-lg"
        >
          <Heart size={23} fill="currentColor" />
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-ink/45">Swipe or use ← and → on your keyboard to pass or like.</p>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink/70">{children}</span>;
}

function formatFood(value?: string) {
  if (!value) return "Food flexible";
  return value === "non_veg" ? "Non-veg" : value === "no_preference" ? "Food flexible" : value[0].toUpperCase() + value.slice(1);
}

function formatCleaning(value?: string) {
  if (!value) return "Cleaning flexible";
  return value === "weekends" ? "Weekend cleaner" : `${value[0].toUpperCase()}${value.slice(1)} cleaning`;
}
