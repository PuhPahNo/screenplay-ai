/**
 * Demo Screenplay Content
 * Pre-filled sample screenplay demonstrating all Fountain format types
 * Used for testing and demonstration purposes
 */

export const DEMO_SCREENPLAY = `Title: The Writer's Dilemma
Author: Screenplay AI
Draft: Demo Version
Date: ${new Date().toLocaleDateString()}

===

# ACT I

INT. COFFEE SHOP - DAY

A bustling urban coffee shop filled with the aroma of fresh coffee and the sound of typing keyboards. Sunlight streams through large windows.

ANNA BLAKE (28), determined but exhausted, sits at a corner table hunched over her laptop. Empty coffee cups surround her workspace.

ANNA BLAKE
(muttering to herself)
This scene needs more conflict. More tension.

She types furiously, then stops, frustrated. Deletes everything she just wrote.

The BARISTA (30s, friendly with a knowing smile) approaches with a fresh cup of coffee.

BARISTA
Another refill? You've been here for six hours straight.

Anna looks up, her eyes tired but grateful.

ANNA BLAKE
You're a lifesaver. I'm on a deadline and this screenplay is fighting me every step of the way.

BARISTA
What's it about?

ANNA BLAKE
A writer trying to finish a screenplay in a coffee shop.

The Barista laughs.

BARISTA
Meta. I like it.
(beat)
You know, sometimes the best writing happens when you stop trying so hard.

Anna considers this wisdom, takes a sip of her fresh coffee.

ANNA BLAKE
Maybe you're right.

The Barista walks away. Anna stares at her screen, then starts typing with renewed energy.

CUT TO:

INT. ANNA'S APARTMENT - NIGHT

A cozy but cluttered studio apartment. Screenplay printouts cover every surface. Anna's desk faces a window overlooking the city.

Anna sits at her desk, still in the same clothes from the coffee shop. She's in the zone now, fingers flying across the keyboard.

Her ROOMMATE, JAKE (29, laid-back musician), enters carrying takeout bags.

JAKE
I brought Chinese food. You need to eat something that isn't coffee.

ANNA BLAKE
(without looking up)
Just five more minutes.

JAKE
That's what you said three hours ago.

Anna finally stops typing and turns to face him.

ANNA BLAKE
Jake, I think I finally cracked it. The breakthrough I've been waiting for.

JAKE
That's great! So you'll take a break?

ANNA BLAKE
(smiling)
Fine. But only because I need to let the ideas marinate.

They sit down to eat. Jake hands her chopsticks.

JAKE
So what's this screenplay about anyway?

ANNA BLAKE
It's about the creative process. The struggle, the breakthroughs, the self-doubt.

JAKE
Sounds personal.

ANNA BLAKE
The best stories always are.

They eat in comfortable silence.

FADE TO:

EXT. CITY STREET - NIGHT

Rain pours down on the empty street. Streetlights reflect off the wet pavement, creating a film noir atmosphere.

Anna exits the coffee shop, laptop bag slung over her shoulder. She doesn't have an umbrella but doesn't seem to care.

She walks with purpose, a small smile on her face. In her hand, a USB drive containing her completed screenplay.

>THE END<

FADE OUT.`;

/**
 * Get character names from the demo screenplay
 * Useful for pre-populating the Characters panel
 */
export function getDemoCharacters() {
  return [
    {
      id: 'anna-blake',
      name: 'ANNA BLAKE',
      description: 'A determined 28-year-old screenwriter struggling to finish her latest screenplay',
      age: '28',
      occupation: 'Screenwriter',
      physicalAppearance: 'Determined but exhausted, with an intense focus that shows her dedication',
      personality: 'Driven, perfectionist, creative, sometimes too hard on herself',
      goals: 'Complete her screenplay and prove herself as a serious writer',
      fears: 'Failing to meet her creative potential, writer\'s block',
      backstory: 'Moved to the city three years ago to pursue screenwriting, working odd jobs while writing',
      arc: 'Learns to balance perfectionism with trust in her creative instincts',
      relationships: {},
      appearances: ['scene-1', 'scene-2', 'scene-3'],
      customAttributes: {
        'Writing Style': 'Character-driven drama',
        'Favorite Genre': 'Indie films',
      },
      notes: 'Protagonist who represents the creative struggle all writers face',
    },
    {
      id: 'barista',
      name: 'BARISTA',
      description: 'A friendly 30-something coffee shop barista with unexpected wisdom',
      age: '30s',
      occupation: 'Barista',
      personality: 'Friendly, observant, surprisingly insightful',
      goals: 'Help customers find their creative flow',
      arc: 'Serves as the wise mentor figure who appears at the right moment',
      relationships: {},
      appearances: ['scene-1'],
      notes: 'Mentor archetype - provides the wisdom Anna needs to break through',
    },
    {
      id: 'jake',
      name: 'JAKE',
      description: 'Anna\'s laid-back musician roommate who keeps her grounded',
      age: '29',
      occupation: 'Musician',
      personality: 'Laid-back, caring, supportive, practical',
      goals: 'Support Anna while pursuing his own music career',
      arc: 'Best friend/roommate who provides emotional support and reality checks',
      relationships: {
        'anna-blake': 'Roommate and close friend',
      },
      appearances: ['scene-2'],
      notes: 'Supporting character who represents the importance of friendship and self-care',
    },
  ];
}

/**
 * Get scene data from the demo screenplay
 * Useful for pre-populating the Scenes panel
 */
export function getDemoScenes() {
  return [
    {
      id: 'scene-1',
      number: 1,
      heading: 'INT. COFFEE SHOP - DAY',
      location: 'Coffee Shop',
      timeOfDay: 'DAY',
      summary: 'Anna struggles with writer\'s block at her usual coffee shop. The Barista offers unexpected wisdom about the creative process.',
      characters: ['ANNA BLAKE', 'BARISTA'],
      startLine: 8,
      endLine: 45,
      content: '',
      order: 1,
      duration: '3 min',
      tags: ['opening', 'writer\'s block', 'mentor moment'],
    },
    {
      id: 'scene-2',
      number: 2,
      heading: 'INT. ANNA\'S APARTMENT - NIGHT',
      location: 'Anna\'s Apartment',
      timeOfDay: 'NIGHT',
      summary: 'Anna continues writing at home with renewed energy. Jake brings food and they discuss the screenplay over dinner.',
      characters: ['ANNA BLAKE', 'JAKE'],
      startLine: 47,
      endLine: 89,
      content: '',
      order: 2,
      duration: '4 min',
      tags: ['breakthrough moment', 'friendship', 'creative process'],
    },
    {
      id: 'scene-3',
      number: 3,
      heading: 'EXT. CITY STREET - NIGHT',
      location: 'City Street',
      timeOfDay: 'NIGHT',
      summary: 'Anna walks through the rain with her completed screenplay, finally at peace with her creative journey.',
      characters: ['ANNA BLAKE'],
      startLine: 91,
      endLine: 99,
      content: '',
      order: 3,
      duration: '1 min',
      tags: ['resolution', 'victory', 'visual ending'],
    },
  ];
}

