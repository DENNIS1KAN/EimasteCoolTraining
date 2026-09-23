# Squad chat: design

A group chat for the squad, merged with the activity the app already generates, with photo sharing.

## 1. Where it lives (decided)

The bottom bar **does not change**: five tabs, Train raised in the middle, exactly as today.

| Surface | What it is |
|---|---|
| **Squad → Chat** | The full merged stream. It **replaces Squad's Feed tab**, which becomes redundant: the stream shows everything the feed shows plus what people say about it. Squad's tabs become `Overview · League · Chat`. |
| **Home card** | The latest few stream items, an unread count, **and a composer**: you can reply without leaving Home. Tapping the list opens `Squad → Chat` for the full history. |

Rejected on the way here: a sixth bottom tab (crowds the bar and costs Train its raised button) and keeping Squad's feed alongside the stream (the same workout would render twice, in two layouts, forever).

**Decided:** the Home card can post. To avoid two copies of the same logic, the composer is **one component**
(`Composer`) used by both surfaces, with the Home instance in a compact variant (single line until focused).
Send, retry and the photo picker live in the component, not in either page.

## 2. Data model

One new table. Activity is **not** stored — `buildFeed` already derives it from workouts, weigh-ins, plans and
cheers, and that stays true.

```ts
export interface Post {
  id: string
  memberId: string          // author
  text: string              // may be empty when the post is only photos
  photos: FileRef[]         // reuses the existing FileRef shape
  createdAt: number
  editedAt: number | null
  updatedAt: number
}
```

`posts` joins `TABLES`, so it inherits the store, the outbox, the last-write-wins merge and the realtime
subscription without special cases. A post is immutable except for `text` (an edit) and deletion by its author
or the coach.

### The merged stream

```
stream(data) = [...buildFeed(data), ...posts].sort(byTimeDesc)
```

A `FeedItem` gains one variant: `{ kind: 'post'; postId; text; photos }`. Everything downstream — day grouping,
kudos, the filter chips — keeps working, because they already switch on `kind`.

Rendering rule: a **post reads as a message** (avatar, name, bubble) and an **activity item reads as a receipt**
(recessed on `--surface-2`, no bubble). That contrast is what stops the stream feeling like a log file.

## 3. Photos

Reuses the `uploadFile` / `fileUrl` / `deleteFile` methods already on `Backend` for meal-plan attachments.

- New Storage bucket `squad-photos`, 10 MB per file, `image/*` only.
- **Downscaled in the browser before upload**: longest edge 1600px, JPEG q0.82, via `createImageBitmap` +
  `OffscreenCanvas`. A modern phone photo is ~4 MB; this lands nearer 300 KB. Supabase's free tier is 1 GB, so
  this is the difference between years and months.
- At most 4 photos per post.
- Deleting a post deletes its objects, reusing the `orphanedFiles` pattern from meal plans.
- In demo mode they go to IndexedDB, exactly as meal-plan files already do.

## 4. Offline

Posts go through the existing outbox: optimistic insert, queued write, retry with backoff, survives the app
being closed and the session expiring. A message typed at the gym on bad signal sends later, like a workout log.

A post whose write is still queued renders with a muted clock instead of its timestamp. A post whose upload
failed shows a retry affordance. Neither blocks the stream.

## 5. Unread

Reuses the `Cheer.seenAt` idea rather than inventing a second mechanism: one `lastSeenPostAt: number | null` added to
`MemberSettings` (`src/data/types.ts:21`), updated when the Chat tab is on screen. Profiles already merge
field by field, so the coach editing a member never clobbers that member's own read marker. Unread count = posts newer than it,
excluding your own.

That count drives the Home card's badge and the dot on the Squad tab. It deliberately does **not** drive a
push notification — the app has no push infrastructure and adding it is its own project.

## 6. Supabase

```sql
create table if not exists public.posts (
  id text primary key,
  member_id uuid not null references public.members on delete cascade,
  data jsonb not null,
  created_at bigint not null,
  updated_at bigint not null,
  constraint posts_data_check check (
    jsonb_typeof(data) = 'object' and data->>'memberId' = member_id::text
  )
);
```

RLS follows the `cheers` precedent exactly: any member of the squad may `select`; `insert` only as yourself;
`update` / `delete` only your own row, or any row if you are the coach (moderation). Storage policies mirror
the `meal-plans` bucket. The table joins the `supabase_realtime` publication in the same loop as the others,
so live delivery needs no new code.

## 7. What changes in existing code

| File | Change |
|---|---|
| `src/data/types.ts` | `Post`, `TABLES`, `Snapshot`, `Tables`, `MemberSettings.lastSeenPostAt` |
| `src/lib/stats/feed.ts` | the `post` variant and the merge |
| `src/features/squad/SquadPage.tsx` | `feed` tab becomes `chat` |
| `src/features/squad/feed/` | becomes `chat/`: `ChatTab`, `Composer`, `PostView`, `PhotoGrid` |
| `src/features/home/` | `SquadChatCard` |
| `supabase/schema.sql` | table, policies, bucket, publication |
| `src/data/demo/seed.ts` | `posts: []` in the snapshot (the app boots clean, so no sample posts) |

## 8. Testing

- `stream()` ordering and the post/activity merge, including same-millisecond ties
- Posting offline: queued, survives a reload, sends on reconnect
- Image downscaling: a 4000px input comes out ≤1600px
- Unread: own posts never count; marking seen is idempotent
- RLS in `supabase/tests/rls.sql`: a member cannot insert as someone else, nor delete another's post; the
  coach can
- The Squad tab renders `chat` for `?tab=chat` and still honours an old `?tab=feed` link

## 9. Order of work

Each phase leaves the app shippable:

1. **Text posts.** `Post`, the table and its policies, the merged stream, `ChatTab` replacing `FeedTab`,
   the composer. No photos, no unread.
2. **Unread.** `lastSeenPostAt`, the Squad tab dot, the Home card.
3. **Photos.** Bucket, policies, browser downscaling, `PhotoGrid`, delete-cleans-up.

## 10. Out of scope

Push notifications, threads and replies, reactions on posts (kudos already exist on activity), typing
indicators, read receipts per person, direct messages (cheers already carry 1:1 messages), video.
