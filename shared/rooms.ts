import { z } from 'zod'
import { analysisGraphSchema, conversationMessageSchema } from './analysis'

export const roomCodeSchema = z.string().trim().toUpperCase().regex(/^GR-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/, 'Enter a room code such as GR-X7K9M2QP.')
export const displayNameSchema = z.string().trim().min(1, 'Enter your display name.').max(80)
export const createRoomSchema = z.object({ displayName: displayNameSchema, roomName: z.string().trim().min(1).max(100) }).strict()
export const joinRoomSchema = z.object({ displayName: displayNameSchema, roomCode: roomCodeSchema }).strict()
export const roomSchema = z.object({ code: roomCodeSchema, guid: z.string(), name: z.string() })
export const roomSessionSchema = z.object({ uid: z.string(), displayName: z.string(), authToken: z.string(), appId: z.string(), region: z.string(), room: roomSchema.nullable() })
export type Room = z.infer<typeof roomSchema>
export type RoomSession = z.infer<typeof roomSessionSchema>
export const sharedGraphSchema = z.object({ graph: analysisGraphSchema, messages: z.array(conversationMessageSchema), version: z.number(), thinking: z.boolean(), error: z.string().nullable() })
export type SharedGraph = z.infer<typeof sharedGraphSchema>
