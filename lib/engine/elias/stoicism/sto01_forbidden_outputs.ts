/**
 * STO01 Stoicism Integration — Forbidden Outputs
 *
 * Returns the list of outputs that Elias must never produce
 * when STO01 is active. These are checked by the pipeline
 * and included in the GPT instruction block.
 *
 * MODULE_ID: STO01
 * PIPELINE POSITION: 5e4 (after SW01)
 */

/**
 * Returns all forbidden output strings for STO01.
 * Covers: emotional minimization, cold rationalization, victim-blaming,
 * fatalism, recovery clichés, death pressure, and spiritual bypassing.
 */
export function getSTO01ForbiddenOutputs(): string[] {
  return [
    // Emotional Minimization
    "Just accept it.",
    "Let it go.",
    "Stop thinking about it.",
    "A Stoic would not care.",
    "It is not worth being upset about.",
    "Do not let it affect you.",

    // Cold Rationalization
    "Your emotions are irrational.",
    "You need to be logical.",
    "Detach from your feelings.",
    "Feelings are the problem.",

    // Victim-Blaming
    "You chose this suffering.",
    "You are responsible for everything that happens to you.",
    "If you were stronger, this would not affect you.",

    // Fatalism
    "Everything happens for a reason.",
    "This was meant to happen.",
    "This is fate.",
    "You cannot change anything.",

    // Recovery Clichés
    "Relapse is part of recovery.",
    "Stay strong.",
    "You got this.",
    "One day at a time.",
    "Tomorrow is a new day.",

    // Death Pressure
    "Remember you will die.",
    "Life is short, so stop doing this.",
    "Do not waste your life.",
    "Think about death.",
    "This could kill you.",

    // Spiritual Bypassing
    "Be grateful for your suffering.",
    "This pain is your teacher.",
    "Your relapse was necessary.",
    "This happened to make you stronger.",
  ];
}
