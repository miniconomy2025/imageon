#!/usr/bin/env node
/**
 * Redis Integration Demo Script
 * 
 * This script demonstrates all the Redis features we've integrated:
 * 1. Fedify KvStore integration
 * 2. Application-level caching (actors, activities)
 * 3. Rate limiting
 * 4. Background job queuing
 */

import { redis } from './src/services/redis.js';
import { QueueProcessor } from './src/services/queue.js';
import { ActorModel } from './src/models/Actor.js';

async function demonstrateRedisIntegration() {
  console.log('🚀 Redis Integration Demonstration\n');
  
  // 1. Test basic Redis connectivity
  console.log('1. Testing Redis connectivity...');
  const isHealthy = await redis.healthCheck();
  console.log(`   Redis health: ${isHealthy ? '✅ Connected' : '❌ Failed'}\n`);
  
  // 2. Test rate limiting
  console.log('2. Testing rate limiting...');
  const rateLimitKey = 'demo:test_user';
  for (let i = 1; i <= 5; i++) {
    const result = await redis.checkRateLimit(rateLimitKey, 3, 60); // 3 requests per minute
    console.log(`   Request ${i}: ${result.allowed ? '✅ Allowed' : '❌ Blocked'} (${result.remaining} remaining)`);
  }
  console.log();
  
  // 3. Test actor caching
  console.log('3. Testing actor caching...');
  const testActorData = {
    id: 'http://localhost:3000/users/demo',
    type: 'Person',
    preferredUsername: 'demo',
    name: 'Demo User',
    summary: 'A demo user for testing Redis integration',
    inbox: 'http://localhost:3000/users/demo/inbox',
    outbox: 'http://localhost:3000/users/demo/outbox',
    followers: 'http://localhost:3000/users/demo/followers',
    following: 'http://localhost:3000/users/demo/following',
    url: 'http://localhost:3000/users/demo',
    published: new Date().toISOString(),
    followers_count: 42,
    following_count: 17
  };
  
  // Cache the actor
  await redis.cacheActor('demo', testActorData);
  console.log('   ✅ Actor cached');
  
  // Retrieve from cache
  const cachedActor = await redis.getCachedActor('demo');
  console.log(`   ✅ Actor retrieved: ${cachedActor?.name} (${cachedActor?.preferredUsername})`);
  
  // Test cache invalidation
  await redis.invalidateActor('demo');
  const invalidatedActor = await redis.getCachedActor('demo');
  console.log(`   ✅ Actor invalidated: ${invalidatedActor ? 'Still cached' : 'Cache cleared'}\n`);
  
  // 4. Test activity caching
  console.log('4. Testing activity caching...');
  const testActivities = [
    {
      id: 'http://localhost:3000/activities/1',
      type: 'Create',
      actor: 'http://localhost:3000/users/demo',
      published: new Date().toISOString(),
      object: { type: 'Note', content: 'Hello, ActivityPub!' }
    },
    {
      id: 'http://localhost:3000/activities/2',
      type: 'Follow',
      actor: 'http://localhost:3000/users/demo',
      published: new Date().toISOString(),
      object: 'http://localhost:3000/users/alice'
    }
  ];
  
  await redis.cacheActorActivities('demo', testActivities);
  console.log('   ✅ Activities cached');
  
  const cachedActivities = await redis.getCachedActorActivities('demo');
  console.log(`   ✅ Activities retrieved: ${cachedActivities?.length} activities\n`);
  
  // 5. Test background job queueing
  console.log('5. Testing background job queueing...');
  
  // Add some federation jobs
  await QueueProcessor.addJob('federation', 'deliver_activity', {
    activityId: 'http://localhost:3000/activities/1',
    targetInbox: 'https://mastodon.social/users/alice/inbox'
  });
  console.log('   ✅ Added delivery job to federation queue');
  
  await QueueProcessor.addJob('federation', 'sync_remote_actor', {
    remoteActorUri: 'https://mastodon.social/users/alice'
  });
  console.log('   ✅ Added sync job to federation queue');
  
  // Add a delayed job (5 seconds)
  await QueueProcessor.addJob('notifications', 'send_notification', {
    type: 'follow',
    targetUser: 'demo',
    fromUser: 'alice'
  }, 5000);
  console.log('   ✅ Added delayed notification job (5s delay)');
  
  // Check queue stats
  const federationStats = await QueueProcessor.getQueueStats('federation');
  const notificationStats = await QueueProcessor.getQueueStats('notifications');
  
  console.log(`   📊 Federation queue: ${federationStats.immediate} immediate, ${federationStats.delayed} delayed`);
  console.log(`   📊 Notifications queue: ${notificationStats.immediate} immediate, ${notificationStats.delayed} delayed\n`);
  
  // 6. Test delivery status caching
  console.log('6. Testing delivery status tracking...');
  
  const activityId = 'http://localhost:3000/activities/1';
  const targetInbox = 'https://mastodon.social/users/alice/inbox';
  
  // Mark as pending
  await redis.cacheDeliveryStatus(activityId, targetInbox, 'pending');
  console.log('   ✅ Delivery marked as pending');
  
  // Check status
  let status = await redis.getDeliveryStatus(activityId, targetInbox);
  console.log(`   📋 Delivery status: ${status?.status} at ${status?.timestamp}`);
  
  // Mark as delivered
  await redis.cacheDeliveryStatus(activityId, targetInbox, 'delivered');
  status = await redis.getDeliveryStatus(activityId, targetInbox);
  console.log(`   ✅ Delivery status updated: ${status?.status}\n`);
  
  // 7. Test follower count caching
  console.log('7. Testing follower count caching...');
  
  await redis.cacheFollowerCount('demo', 42);
  console.log('   ✅ Follower count cached');
  
  const followerCount = await redis.getCachedFollowerCount('demo');
  console.log(`   📊 Cached follower count: ${followerCount}\n`);
  
  console.log('🎉 Redis integration demonstration complete!');
  console.log('\nKey benefits of our Redis integration:');
  console.log('📈 Fedify KvStore: Efficient internal caching for federation operations');
  console.log('⚡ Application caching: Fast actor and activity retrieval');
  console.log('🛡️  Rate limiting: Protection against abuse');
  console.log('🔄 Background queues: Asynchronous federation delivery');
  console.log('📊 Delivery tracking: Monitor federation success/failure');
  console.log('🎯 Smart caching: Reduced database load and faster responses');
}

// Run the demonstration
demonstrateRedisIntegration().catch(console.error);
