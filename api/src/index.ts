import express from 'express'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const app = express()

app.use(express.json())
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  next()
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mooki-tipster-api' })
})

const PORT = Number(process.env.PORT ?? 3000)

app.listen(PORT, () => {
  console.log(`mooki-tipster api listening on port ${PORT}`)
})

export { prisma }
