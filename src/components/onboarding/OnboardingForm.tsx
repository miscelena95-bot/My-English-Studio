"use client";

import { useActionState, useState } from "react";
import { saveOnboarding, applyDefaults, type FormState } from "@/app/actions/profile";
import { GOAL_OPTIONS, INTEREST_OPTIONS, LEVELS, PROFESSIONAL_OPTIONS } from "@/lib/validation/profile";
import { Button, Notice, ProgressBar } from "@/components/ui";

interface Defaults {
  name: string | null;
  selfAssessedLevel: string;
  goals: string[];
  sessionMinutes: number;
  correctionStyle: string;
  interests: string[];
  professionalFocus: string[];
  structureBalance: string;
  speakingMode: string;
}

const STEPS = ["About you", "Your goals", "Your sessions", "Your interests"];

export function Chips({ name, options, selected }: { name: string; options: readonly string[]; selected: string[] }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <label className="chip" key={o}>
          <input type="checkbox" name={name} value={o} defaultChecked={selected.includes(o)} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

export function RadioCards({ name, options, value }: { name: string; options: Array<{ value: string; label: string; help: string }>; value: string }) {
  return (
    <div className="radio-cards">
      {options.map((o) => (
        <label className="radio-card" key={o.value}>
          <input type="radio" name={name} value={o.value} defaultChecked={value === o.value} />
          <span>
            <strong>{o.label}</strong>
            <span className="small muted">{o.help}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export const CORRECTION_OPTIONS = [
  { value: "adaptive", label: "Adaptive (recommended)", help: "Fluency mode for free conversation, coaching for role-plays, precision for targeted practice." },
  { value: "fluency", label: "Fluency", help: "Let me speak; give me feedback at the end." },
  { value: "coaching", label: "Coaching", help: "Correct important errors at natural pauses." },
  { value: "precision", label: "Precision", help: "Correct me in detail, immediately." },
];

export const BALANCE_OPTIONS = [
  { value: "guided", label: "Mostly guided", help: "Follow the Learning Path; recommendations fill the gaps." },
  { value: "mixed", label: "A mix (recommended)", help: "Guided lessons plus free exploration." },
  { value: "explore", label: "Mostly exploring", help: "Recommendations based on my weaknesses, no fixed path." },
];

export function OnboardingForm({ defaults }: { defaults: Defaults }) {
  const [step, setStep] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(saveOnboarding, { ok: true });

  return (
    <div className="stack-l">
      <div className="stack-s">
        <div className="row-between small muted">
          <span>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </span>
          <form action={applyDefaults}>
            <button className="btn btn-ghost btn-small" type="submit">
              Skip — use recommended settings
            </button>
          </form>
        </div>
        <ProgressBar value={step + 1} max={STEPS.length} label="Onboarding progress" thin />
      </div>

      {state.errors && (
        <Notice tone="error" title="Please check a few things">
          <ul className="mb-0">
            {Object.values(state.errors).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      )}

      <form action={action} className="stack-l">
        {/* All steps stay in the DOM so the form submits everything at the end. */}
        <fieldset hidden={step !== 0} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">About you</legend>
          <div className="field">
            <label className="label" htmlFor="name">
              What should I call you? <span className="muted">(optional)</span>
            </label>
            <input id="name" name="name" className="input" defaultValue={defaults.name ?? ""} maxLength={40} autoComplete="given-name" style={{ maxWidth: 360 }} />
            <span className="help">Only used to greet you. Nothing else personal is needed.</span>
          </div>
          <div className="field">
            <span className="label">How would you describe your English right now?</span>
            <div className="chips" role="radiogroup">
              {LEVELS.map((l) => (
                <label className="chip" key={l}>
                  <input type="radio" name="selfAssessedLevel" value={l} defaultChecked={defaults.selfAssessedLevel === l} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
            <span className="help">A rough guess is fine — the short diagnostic will refine it. B1+ = you understand a lot but speaking and writing feel slower.</span>
          </div>
        </fieldset>

        <fieldset hidden={step !== 1} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 8 }}>
            What do you want English for? Keep everything that matters to you.
          </legend>
          <Chips name="goals" options={GOAL_OPTIONS} selected={defaults.goals} />
          <div className="field" style={{ marginTop: 12 }}>
            <span className="label">Professional situations to practise</span>
            <Chips name="professionalFocus" options={PROFESSIONAL_OPTIONS} selected={defaults.professionalFocus} />
          </div>
        </fieldset>

        <fieldset hidden={step !== 2} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">Your sessions</legend>
          <div className="field">
            <label className="label" htmlFor="sessionMinutes">
              Daily session length
            </label>
            <select id="sessionMinutes" name="sessionMinutes" className="select" defaultValue={defaults.sessionMinutes} style={{ maxWidth: 280 }}>
              <option value={10}>10 minutes (busy days)</option>
              <option value={20}>20 minutes</option>
              <option value={25}>25 minutes (recommended)</option>
              <option value={30}>30 minutes</option>
              <option value={40}>40 minutes (extended)</option>
            </select>
            <span className="help">You can always choose a shorter or longer session on the day.</span>
          </div>
          <div className="field">
            <span className="label">How should corrections work in conversations?</span>
            <RadioCards name="correctionStyle" options={CORRECTION_OPTIONS} value={defaults.correctionStyle} />
          </div>
          <div className="field">
            <span className="label">Speaking practice</span>
            <RadioCards
              name="speakingMode"
              value={defaults.speakingMode}
              options={[
                { value: "both", label: "Voice and text", help: "Use the microphone when the browser supports it, typing otherwise." },
                { value: "text", label: "Text only", help: "Type your side of the conversation." },
                { value: "voice", label: "Voice first", help: "Start conversations with the microphone." },
              ]}
            />
          </div>
        </fieldset>

        <fieldset hidden={step !== 3} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 8 }}>
            What do you enjoy? Real English content will be chosen from these.
          </legend>
          <Chips name="interests" options={INTEREST_OPTIONS} selected={defaults.interests} />
          <div className="field" style={{ marginTop: 12 }}>
            <span className="label">Structure</span>
            <RadioCards name="structureBalance" options={BALANCE_OPTIONS} value={defaults.structureBalance} />
          </div>
        </fieldset>

        <div className="row-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <div className="row">
              <button className="btn" type="submit" name="next" value="home" disabled={pending}>
                Save and go to my studio
              </button>
              <button className="btn btn-primary" type="submit" name="next" value="diagnostic" disabled={pending}>
                {pending ? <span className="spinner" aria-label="Saving" /> : "Save and take the 10-minute diagnostic"}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
