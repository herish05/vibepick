/**
 * Seed catalog: metadata for real songs, with ILLUSTRATIVE Song DNA (estimated feature values for
 * development only). No audio is bundled. In production, metadata/features come from a licensed provider
 * + the ML service's music embedding pipeline.
 */
import { PrismaClient, type Prisma } from '@prisma/client';

type Preset = { mood: Record<string, number>; aesthetic: Record<string, number>; occasions: string[]; energy: number; dance: number };

const P: Record<string, Preset> = {
  party: { mood: { happy: 0.8, energetic: 0.9, party: 0.95, confident: 0.6 }, aesthetic: { night: 0.8, luxury: 0.5, party: 0.9 }, occasions: ['party', 'birthday', 'friends', 'night-out'], energy: 0.9, dance: 0.88 },
  swag: { mood: { confident: 0.92, energetic: 0.75, party: 0.5 }, aesthetic: { luxury: 0.8, night: 0.7, aesthetic: 0.6 }, occasions: ['night-out', 'friends', 'gym'], energy: 0.78, dance: 0.7 },
  romantic: { mood: { romantic: 0.92, emotional: 0.6, chill: 0.4, aesthetic: 0.5 }, aesthetic: { aesthetic: 0.8, warm: 0.7, cinematic: 0.5 }, occasions: ['wedding', 'couple', 'travel'], energy: 0.4, dance: 0.4 },
  sad: { mood: { sad: 0.9, emotional: 0.9, nostalgic: 0.6 }, aesthetic: { rainy: 0.8, night: 0.6, cinematic: 0.5 }, occasions: ['rainy', 'solo'], energy: 0.25, dance: 0.2 },
  chill: { mood: { chill: 0.9, peaceful: 0.7, aesthetic: 0.7, happy: 0.4 }, aesthetic: { aesthetic: 0.85, travel: 0.6, sunset: 0.7 }, occasions: ['travel', 'solo', 'friends'], energy: 0.35, dance: 0.4 },
  cinematic: { mood: { cinematic: 0.92, emotional: 0.7, confident: 0.5 }, aesthetic: { cinematic: 0.9, travel: 0.5 }, occasions: ['travel', 'festival', 'solo'], energy: 0.6, dance: 0.35 },
  nostalgic: { mood: { nostalgic: 0.9, happy: 0.5, romantic: 0.5, chill: 0.5 }, aesthetic: { retro: 0.8, warm: 0.6 }, occasions: ['graduation', 'friends', 'solo'], energy: 0.45, dance: 0.4 },
  fun: { mood: { funny: 0.8, happy: 0.85, party: 0.6, energetic: 0.7 }, aesthetic: { party: 0.6, street: 0.5 }, occasions: ['friends', 'birthday', 'festival'], energy: 0.8, dance: 0.8 },
};

// [title, artist, language, genres, preset, popularity, year, tempo]
const SONGS: [string, string, string, string[], keyof typeof P, number, number, number][] = [
  ['Heeriye', 'Jasleen Royal', 'Hindi', ['pop'], 'romantic', 0.8, 2023, 98],
  ['Kesariya', 'Arijit Singh', 'Hindi', ['bollywood'], 'romantic', 0.9, 2022, 90],
  ['Tum Hi Ho', 'Arijit Singh', 'Hindi', ['bollywood'], 'sad', 0.92, 2013, 70],
  ['Channa Mereya', 'Arijit Singh', 'Hindi', ['bollywood'], 'sad', 0.85, 2016, 78],
  ['Kal Ho Naa Ho', 'Sonu Nigam', 'Hindi', ['bollywood'], 'nostalgic', 0.7, 2003, 82],
  ['Gallan Goodiyan', 'Shankar Mahadevan', 'Hindi', ['bollywood'], 'party', 0.7, 2015, 120],
  ['Badtameez Dil', 'Benny Dayal', 'Hindi', ['bollywood'], 'fun', 0.75, 2013, 128],
  ['Kar Gayi Chull', 'Badshah', 'Hindi', ['bollywood', 'hip-hop'], 'party', 0.8, 2016, 112],
  ['Apna Time Aayega', 'Ranveer Singh', 'Hindi', ['hip-hop'], 'swag', 0.7, 2019, 96],
  ['Ilahi', 'Arijit Singh', 'Hindi', ['bollywood'], 'cinematic', 0.65, 2013, 90],
  ['Raataan Lambiyan', 'Jubin Nautiyal', 'Hindi', ['bollywood'], 'romantic', 0.82, 2021, 92],
  ['Agar Tum Saath Ho', 'Alka Yagnik', 'Hindi', ['bollywood'], 'sad', 0.75, 2015, 70],
  ['Ik Vaari Aa', 'Arijit Singh', 'Hindi', ['bollywood'], 'nostalgic', 0.5, 2017, 85],
  ['Dil Diyan Gallan', 'Atif Aslam', 'Hindi', ['bollywood'], 'romantic', 0.7, 2017, 80],
  ['Moh Moh Ke Dhaagey', 'Papon', 'Hindi', ['indie'], 'chill', 0.35, 2015, 80],
  ['Kabira', 'Tochi Raina', 'Hindi', ['bollywood'], 'cinematic', 0.6, 2013, 100],
  ['Lover', 'Diljit Dosanjh', 'Punjabi', ['pop'], 'romantic', 0.7, 2022, 100],
  ['Lover Boy', 'Diljit Dosanjh', 'Punjabi', ['pop'], 'swag', 0.45, 2023, 96],
  ['Brown Munde', 'AP Dhillon', 'Punjabi', ['hip-hop'], 'swag', 0.9, 2020, 100],
  ['Excuses', 'AP Dhillon', 'Punjabi', ['hip-hop', 'pop'], 'chill', 0.88, 2020, 98],
  ['Softly', 'Karan Aujla', 'Punjabi', ['hip-hop'], 'swag', 0.8, 2023, 100],
  ['Players', 'Karan Aujla', 'Punjabi', ['hip-hop'], 'party', 0.72, 2022, 104],
  ['295', 'Sidhu Moose Wala', 'Punjabi', ['hip-hop'], 'swag', 0.88, 2021, 90],
  ['The Last Ride', 'Sidhu Moose Wala', 'Punjabi', ['hip-hop'], 'sad', 0.75, 2022, 94],
  ['Do You Know', 'Diljit Dosanjh', 'Punjabi', ['pop'], 'fun', 0.55, 2020, 108],
  ['Laembadgini', 'Diljit Dosanjh', 'Punjabi', ['pop'], 'party', 0.7, 2016, 100],
  ['Tere Te', 'Gur Sidhu', 'Punjabi', ['pop'], 'romantic', 0.3, 2022, 90],
  ['Obsessed', 'Riar Saab', 'Punjabi', ['pop'], 'chill', 0.3, 2024, 95],
  ['Blinding Lights', 'The Weeknd', 'English', ['synth-pop'], 'swag', 0.97, 2019, 171],
  ['Levitating', 'Dua Lipa', 'English', ['pop'], 'party', 0.9, 2020, 103],
  ['Industry Baby', 'Lil Nas X', 'English', ['hip-hop'], 'swag', 0.85, 2021, 150],
  ['Lover', 'Taylor Swift', 'English', ['pop'], 'romantic', 0.9, 2019, 68],
  ['Sunflower', 'Post Malone', 'English', ['pop'], 'chill', 0.93, 2018, 90],
  ['Golden Hour', 'JVKE', 'English', ['pop'], 'cinematic', 0.8, 2022, 94],
  ['Sunset Lover', 'Petit Biscuit', 'English', ['electronic'], 'chill', 0.55, 2015, 90],
  ['Dandelions', 'Ruth B.', 'English', ['indie'], 'romantic', 0.75, 2016, 116],
  ['Daylight', 'David Kushner', 'English', ['pop'], 'sad', 0.7, 2023, 130],
  ['Vegas', 'Doja Cat', 'English', ['pop'], 'swag', 0.6, 2022, 100],
  ['Kun Faya Kun', 'A. R. Rahman', 'Hindi', ['sufi'], 'cinematic', 0.7, 2011, 85],
  ['Chaleya', 'Arijit Singh', 'Hindi', ['bollywood'], 'romantic', 0.88, 2023, 105],
  ['Pehle Bhi Main', 'Vishal Mishra', 'Hindi', ['bollywood'], 'sad', 0.82, 2023, 76],
  ['Naacho Naacho', 'Rahul Sipligunj', 'Telugu', ['film'], 'party', 0.85, 2022, 150],
  ['Butta Bomma', 'Armaan Malik', 'Telugu', ['film'], 'romantic', 0.8, 2020, 100],
  ['Kaavaalaa', 'Shilpa Rao', 'Tamil', ['film'], 'swag', 0.82, 2023, 105],
  ['Vaathi Coming', 'Anirudh Ravichander', 'Tamil', ['film'], 'party', 0.75, 2021, 125],
  ['Ami Je Tomar', 'Shreya Ghoshal', 'Bengali', ['film'], 'romantic', 0.5, 2007, 80],
  ['Jhingaat', 'Ajay-Atul', 'Marathi', ['film'], 'fun', 0.7, 2016, 130],
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  for (const [title, artistName, language, genres, preset, popularity, year, tempo] of SONGS) {
    const p = P[preset]!;
    const artist = await prisma.artist.upsert({ where: { name: artistName }, create: { name: artistName, genres }, update: {} });
    const externalId = `seed:${artistName}:${title}`.toLowerCase();
    const features = {
      mood: p.mood as Prisma.InputJsonValue, aesthetic: p.aesthetic as Prisma.InputJsonValue, occasions: p.occasions,
      tempo, energy: p.energy, danceability: p.dance, embedding: [] as number[],
    };
    await prisma.song.upsert({
      where: { externalId },
      create: { title, artistId: artist.id, language, genres, popularity, releaseYear: year, externalId, features: { create: features } },
      update: { popularity, features: { update: features } },
    });
  }
  console.log(`seeded ${SONGS.length} songs`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
