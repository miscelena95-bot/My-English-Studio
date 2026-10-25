"use client";

import { useActionState } from "react";
import { saveSettings, type FormState } from "@/app/actions/profile";
import { GOAL_OPTIONS, INTEREST_OPTIONS, LEVELS, PROFESSIONAL_OPTIONS } from "@/lib/validation/profile";
import { BALANCE_OPTIONS, Chips, CORRECTION_OPTIONS, RadioCards } from "@/components/onboarding/OnboardingForm";
import { Notice } from "@/components/ui";

export interface SettingsDefaults {
  name: string | null;
  selfAssessedLevel: string;
  goals: string[];
  sessionMinutes: number;
  correctionStyle: string;
  interests: string[];
  professionalFocus: string[];
  structureBalance: string;
  speakingMode: string;
  weeklyGoalMinutes: number;
  weeklyGoalSessions: number;
  showStreak: boolean;
  storeTranscripts: boolean;
  breakUntil: string | null;
}

export function SettingsForm({ d }: { d: SettingsDefaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, { ok: true });
  const err = (k: string) => state.errors?.[k] && <span className="field-error">{state.errors[k]}</span>;
  return (
    <form action={action} className="stack-l">
      {state.message && <Notice tone="success" role="status">{state.message}</Notice>}
      {state.errors && <Notice tone="error">Please fix the highlighted fields.</Notice>}
      <input type="hidden" name="breakUntil" value={d.breakUntil ?? ""} />

      <section className="card stack" aria-labelledby="s-you">
        <h2 id="s-you">You</h2>
        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="name">Name (optional)</label>
            <input id="name" name="name" className="input" defaultValue={d.name ?? ""} maxLength={40} />
            {err("name")}
          </div>
          <div className="field">
            <label className="label" htmlFor="lvl">Self-assessed level</label>
            <select id="lvl" name="selfAssessedLevel" className="select" defaultValue={d.selfAssessedLevel}>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <span className="label">Goals</span>
          <Chips name="goals" options={GOAL_OPTIONS} selected={d.goals} />
          {err("goals")}
        </div>
      </section>

      <section className="card stack" aria-labelledby="goals" id="goals">
        <h2>Sessions and goals</h2>
        <div className="grid-3">
          <div className="field">
            <label className="label" htmlFor="sessionMinutes">Daily session (minutes)</label>
            <input id="sessionMinutes" name="sessionMinutes" type="number" min={10} max={60} className="input" defaultValue={d.sessionMinutes} aria-invalid={!!state.errors?.sessionMinutes} />
            {err("sessionMinutes")}
          </div>
          <div className="field">
            <label className="label" htmlFor="wgm">Weekly goal (minutes)</label>
            <input id="wgm" name="weeklyGoalMinutes" type="number" min={30} max={840} className="input" defaultValue={d.weeklyGoalMinutes} aria-invalid={!!state.errors?.weeklyGoalMinutes} />
            {err("weeklyGoalMinutes")}
          </div>
          <div className="field">
            <label className="label" htmlFor="wgs">Weekly goal (active days)</label>
            <input id="wgs" name="weeklyGoalSessions" type="number" min={1} max={7} className="input" defaultValue={d.weeklyGoalSessions} aria-invalid={!!state.errors?.weeklyGoalSessions} />
            {err("weeklyGoalSessions")}
          </div>
        </div>
        <label className="row small">
          <input type="checkbox" name="showStreak" defaultChecked={d.showStreak} /> Show my learning streak (rest days never delete history)
        </label>
        <div className="field">
          <span className="label">Structure</span>
          <RadioCards name="structureBalance" options={BALANCE_OPTIONS} value={d.structureBalance} />
        </div>
      </section>

      <section className="card stack" aria-labelledby="s-speaking">
        <h2 id="s-speaking">Speaking and corrections</h2>
        <div className="field">
          <span className="label">Default correction style</span>
          <RadioCards name="correctionStyle" options={CORRECTION_OPTIONS} value={d.correctionStyle} />
        </div>
        <div className="field">
          <label className="label" htmlFor="speakingMode">Speaking input</label>
          <select id="speakingMode" name="speakingMode" className="select" defaultValue={d.speakingMode} style={{ maxWidth: 280 }}>
            <option value="both">Voice and text</option>
            <option value="text">Text only</option>
            <option value="voice">Voice first</option>
          </select>
        </div>
        <label className="row small">
          <input type="checkbox" name="storeTranscripts" defaultChecked={d.storeTranscripts} /> Keep conversation transcripts after the feedback report (needed to re-read past conversations)
        </label>
      </section>

      <section className="card stack" aria-labelledby="s-interests">
        <h2 id="s-interests">Interests and professional focus</h2>
        <Chips name="interests" options={INTEREST_OPTIONS} selected={d.interests} />
        <Chips name="professionalFocus" options={PROFESSIONAL_OPTIONS} selected={d.professionalFocus} />
      </section>

      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? <span className="spinner" aria-label="Saving" /> : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
