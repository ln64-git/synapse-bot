

how are we going to determain relationships


- Determain an affiliation rating
  - How often users interact with eachother
  - affiliations are monolateral
  - how oftern does a user interact with another user
    - reactions
    - mentions
    - replies
    - compare time in vc relitivly
      - how often does the user vc with a given user compared to other users
- Once we have an understanding of how often two user's interact with eachother with through an affinity map
- we can understand the nature of the affinity


- we need to map users into the database with roles
- we also need to map messages into the database with mentions, reactions, and reply information
- this needs to be a background service but also a command to sync the database with past content from the guild

- we need to identity the content discussed in the discord messages
  - we should use a nlp library to derive keywords
  - then we should build embeddings based on the keywords for each message
  - finally we can store the message in the database with relitive keywords and vector embeddings for each keyword


- we need to identify conversations
  - this means when two or more users interact with eachother in a back and forth
  - we can also use message neighbor relevence by analyzing cosine distence between plotted message keyword embeddings aka how similar are topics discussed in close proximity of eachother in chat
  - once we have established conversations 
  - then we can map participents, keywords and generated vector embeddings for the relitave keywords of the conversation 
  - Now we can map discussions and topics directly to users in the database

- this should give us more of a nuance layer to analyze user relationships beyond the affinity score

  - starting from highest affinity relationships to the lowest
  - we will analyze conversations between two users to derive monolateral relational sentement keywords to store with vector embeddings in the relationship map database
  - Now we have sentimental vector mapping and keywords to define relationships between users
  - Now we can use AI to summerize the user relationships with relational keyuwords and conversational context 
  - We will keep summories in the relationship map database 


- after establishing the nuance of user relationships with keywords, summories

- Now we can flesh out users in the DB
- we should keep track of any name changes display name or username as aileses
- roles 

- now we can use this information as context for LLM querries

- when making a querry about a user
- pull up the user and any relitive information or messasges
- takes in to account 
  - name
  - roles
  - keywords
  - relationships
    - keywords and roles of closest friends
    - keywords and roles of enemys
  - most controversal conversations / messages


---

Here’s a cleaned-up, structured version of your notes. I’ve grouped related points together, clarified language, and made the flow more logical so it reads like a roadmap instead of scattered bullets:

---

# Relationship Mapping Plan

## 1. Determining Affiliation / Affinity

* **Affinity Rating**: Quantify how closely two users are connected.

  * Measure how often users interact with each other.
  * Note: Affiliations are **monolateral** (not always reciprocal).
* **Interaction Types to Track**:

  * Reactions
  * Mentions
  * Replies
  * Voice chat participation

    * Compare how often a user joins VC with a specific person relative to others.

➡️ Output: An **Affinity Map** showing relative strength of user-to-user interactions.

---

## 2. Data Capture & Storage

* **User Mapping**:

  * Store users in DB with roles, aliases (track name changes: display name & username).
* **Message Mapping**:

  * Store messages with metadata:

    * Mentions
    * Reactions
    * Reply chains
* **Syncing**:

  * Background service continuously updates data.
  * Command available to backfill database with historical guild content.

---

## 3. Message Content Analysis

* **Topic Extraction**:

  * Use NLP to derive keywords from messages.
* **Embeddings**:

  * Generate embeddings for keywords.
  * Store messages in DB with associated keywords + vector embeddings.

---

## 4. Conversation Identification

* **Definition**: A back-and-forth interaction between two or more users.
* **Detection Methods**:

  * Sequential interactions (replies, mentions, short timeframes).
  * Semantic similarity:

    * Compare embeddings (cosine distance) to detect topic continuity.
* **Mapping Conversations**:

  * Participants
  * Keywords
  * Vector embeddings for conversation topics

➡️ Conversations mapped to **users + topics** in the DB.

---

## 5. Relationship Nuance Layer

* Move beyond simple affinity score:

  * Analyze conversations starting with highest-affinity relationships down.
  * Derive **monolateral relational sentiment**:

    * Store sentiment keywords + embeddings in relationship map DB.
  * Generate **summaries** of relationships:

    * Keywords
    * Conversational context
    * Store summaries alongside relationship metadata.

---

## 6. User Profiles in Database

* Track:

  * User aliases (display name & username changes).
  * Roles.
  * Relationships:

    * Friends (closest affinity + sentiment keywords/roles).
    * Enemies (negative affinity + sentiment keywords/roles).
  * Most controversial conversations/messages.

➡️ Results in **fleshed-out user profiles** with context for analysis.

---

## 7. LLM Query Integration

* When querying about a user:

  * Pull relevant context:

    * Name + aliases
    * Roles
    * Keywords
    * Relationship data (friends, enemies, sentiment)
    * Notable/controversial conversations
* Provide this context to the LLM to generate nuanced answers about user relationships and interactions.

---

✅ **Summary / Action Plan**:

1. Build an **affinity scoring system** (interactions + VC time).
2. Store all **users, messages, and roles** in DB with metadata.
3. Use **NLP + embeddings** to analyze messages and group into conversations.
4. Enrich user-to-user links with **sentiment, keywords, and summaries**.
5. Keep profiles updated with aliases, roles, and controversial messages.
6. Use this enriched DB as **context provider for LLM queries**.

---

Do you want me to also **diagram this as a pipeline/flowchart** so you can see the data flow from “raw messages → LLM-ready relationship map”? That would make it even easier to design and implement.
