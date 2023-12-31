import 'dotenv/config'
import Fastify from 'fastify'
import { Client } from '@notionhq/client';
import Joi from 'joi';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

const requestSchema = Joi.object({
  nonce: Joi.string().required().not("%%__NONCE__%%").required(),
  user_id: Joi.string().alphanum().not("%%__USER__%%").required(),
  resource: Joi.string().uppercase().valid("HYRONIC_LOBBY").required(),
})

async function run() {

  const fastify = Fastify({
    logger: true
  })

  await fastify.register(import('@fastify/rate-limit'), {
    max: 10,
    timeWindow: '1 minute'
  })


  fastify.setErrorHandler(function (error, request, reply) {
    if (error.statusCode === 429) {
      reply.code(429)
      error.message = 'You hit the rate limit! Slow down please!'
    }
    reply.send({
      isValid: false,
      reason: "Too many requests, DDOS detected!"
    })
  })

  fastify.get('/', async function handler(request, reply) {
    return { message: "HyronicStudios @ 2023" }
  })


  fastify.post('/validate', async function handler(request, reply) {

    const data = request.body;
    const { value, error } = requestSchema.validate(data)

    if (error) {

      console.log(`Licenses request invalid data: [${data.nonce} ${data.user_id} ${data.resource}]`);

      return {
        isValid: false,
        reason: "Invalid request data!"
      }
    }

    const blockedDb = await notion.databases.query({
      database_id: "0251f0ec2e8f458182b775d919609c56",
      filter: {
        and: [
          {
            property: "UserId",
            rich_text: {
              equals: data.user_id
            }
          },
          {
            property: "Resource",
            select: {
              equals: data.resource
            }
          }
        ]
      }
    })

    if (blockedDb.results.length > 0) {

      console.log(`Licenses request blocked: [${data.nonce} ${data.user_id} ${data.resource}]`);


      return {
        isValid: false,
        reason: "Your license got blocked: " + blockedDb.results[0].properties.Reason.rich_text[0].plain_text
      }
    }

    console.log(`Licenses request valid: [${data.nonce} ${data.user_id} ${data.resource}]`);

    return { isValid: true, reason: "Your licenes is okay" }
  })

  // Run the server!
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}


run();
