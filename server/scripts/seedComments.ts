import 'dotenv/config';
import { getDb } from '../lib/mongodb';

/**
 * Seeds a spread of demo reader comments across existing posts so the moderation queue (and the
 * sidebar's pending badge) have realistic data to work with. Statuses are mixed — mostly
 * `pending` (the queue), a few `approved`, a couple of obvious `rejected` spam.
 *
 * Inserted with the native driver (not the Mongoose model) so each comment can carry a
 * realistic backdated `createdAt` — the model would stamp them all "now". The stored shape is
 * identical to a model-written doc, so the admin API reads them back normally.
 *
 * Idempotent: each demo comment has a unique `authorEmail`; one already present is skipped, so
 * re-running never piles up duplicates. Needs at least one post to attach to.
 *
 * Run:  node --env-file=.env node_modules/.bin/ts-node scripts/seedComments.ts
 *   or: npm run seed:comments
 */
type DemoComment = {
  name: string;
  email: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  ip: string;
  ageHours: number; // how long ago it was posted
};

const DEMO_COMMENTS: DemoComment[] = [
  { name: 'Chinedu Okafor', email: 'chinedu.okafor@example.com', body: 'This is exactly the kind of analysis the market needs. The point about local distribution economics is spot on.', status: 'pending', ip: '102.89.34.12', ageHours: 3 },
  { name: 'Aisha Bello', email: 'aisha.bello@example.com', body: 'Would love to see a follow-up piece with the actual numbers behind these projections.', status: 'pending', ip: '197.210.55.8', ageHours: 9 },
  { name: 'Tunde Adewale', email: 'tunde.adewale@example.com', body: 'Great read. Sharing this with my team at the agency — very relevant to what we are planning for Q3.', status: 'pending', ip: '41.203.18.77', ageHours: 20 },
  { name: 'Ngozi Eze', email: 'ngozi.eze@example.com', body: 'I disagree with the framing here. The regulatory angle is more complicated than the article suggests.', status: 'pending', ip: '105.112.9.240', ageHours: 27 },
  { name: 'Emeka Okoro', email: 'emeka.okoro@example.com', body: 'Finally someone covering this properly. Nigerian business media rarely goes this deep.', status: 'pending', ip: '154.118.22.5', ageHours: 44 },
  { name: 'Fatima Yusuf', email: 'fatima.yusuf@example.com', body: 'Do you have a source for the market-size figure? Keen to cite it in a report I am writing.', status: 'pending', ip: '129.205.13.90', ageHours: 51 },
  { name: 'Segun Balogun', email: 'segun.balogun@example.com', body: 'Solid piece, though I think the timeline is optimistic given current FX conditions.', status: 'pending', ip: '102.176.65.31', ageHours: 68 },
  { name: 'Chioma Nwosu', email: 'chioma.nwosu@example.com', body: 'Bookmarking this. The section on consumer behaviour answered a question my team has been debating.', status: 'pending', ip: '197.253.7.144', ageHours: 5 },
  { name: 'Ibrahim Musa', email: 'ibrahim.musa@example.com', body: 'Excellent context. This is why I keep coming back to Brandish for the business angle.', status: 'approved', ip: '41.184.90.6', ageHours: 30 },
  { name: 'Blessing Adeyemi', email: 'blessing.adeyemi@example.com', body: 'Really clear explanation. Even non-specialists can follow the argument here.', status: 'approved', ip: '105.235.44.19', ageHours: 54 },
  { name: 'Yakubu Danjuma', email: 'yakubu.danjuma@example.com', body: 'The comparison with the East African markets was the most useful part for me.', status: 'approved', ip: '154.66.11.203', ageHours: 76 },
  { name: 'Amara Okeke', email: 'amara.okeke@example.com', body: 'Well argued and well sourced. Looking forward to the next in the series.', status: 'approved', ip: '197.211.60.88', ageHours: 120 },
  { name: 'crypto_deals_247', email: 'noreply@fastmail-x9.ru', body: 'AMAZING returns guaranteed!!! Click my profile for the best investment signals — limited spots this week only.', status: 'rejected', ip: '45.132.8.201', ageHours: 6 },
  { name: 'seo_backlinks_pro', email: 'promo@rank-boost.biz', body: 'Boost your traffic 10x with our premium backlink packages. DM for a special discount today!!!', status: 'rejected', ip: '193.42.98.14', ageHours: 14 },
];

export async function seedComments(): Promise<{ created: number; skipped: number }> {
  const db = await getDb();
  const posts = await db.collection('posts').find({}, { projection: { _id: 1 } }).limit(20).toArray();
  if (posts.length === 0) {
    console.log('Seed comments: no posts found — seed posts first, then re-run.');
    return { created: 0, skipped: 0 };
  }

  const comments = db.collection('comments');
  let created = 0;
  let skipped = 0;

  for (const [index, c] of DEMO_COMMENTS.entries()) {
    if (await comments.findOne({ authorEmail: c.email })) {
      skipped++;
      continue;
    }
    const post = posts[index % posts.length];
    await comments.insertOne({
      postId: post._id, // already an ObjectId — matches how the model stores it
      authorName: c.name,
      authorEmail: c.email,
      body: c.body,
      status: c.status,
      ip: c.ip,
      createdAt: new Date(Date.now() - c.ageHours * 3600 * 1000),
    });
    created++;
  }

  console.log(`Seed comments: ${created} created, ${skipped} skipped (already present).`);
  return { created, skipped };
}

if (require.main === module) {
  seedComments()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
