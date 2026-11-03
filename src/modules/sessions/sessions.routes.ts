import type { FastifyInstance } from 'fastify'

import { authenticate } from '../../shared/auth/authenticate.js'
import { authorizeProfile } from '../../shared/auth/authorize-profile.js'
import { startActivityController } from './start-activity.controller.js'
import { pauseActivityController } from './pause-activity.controller.js'
import { resumeActivityController } from './resume-activity.controller.js'
import { startRestController } from './start-rest.controller.js'
import { endRestController } from './end-rest.controller.js'
import { completeActivityController } from './complete-activity.controller.js'
import { finishSessionController } from './finish-session.controller.js'
import { interruptSessionController } from './interrupt-session.controller.js'
import { listSessionsController } from './list-sessions.controller.js'

import {
  getSessionResultController,
  recordActivityObservationController,
  startSessionController,
  sessionsService
} from './sessions.controller.js'

import { registerExecutionController } from './register-execution.controller.js'

export async function sessionRoutes(server: FastifyInstance) {
  server.post('/sessions', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, startSessionController)

  server.post('/sessions/:sessionId/activities/:activityId/start', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, startActivityController(sessionsService))

  server.post<{
    Params: { sessionId: string; activityId: string }
    Body: { observation: string }
  }>('/sessions/:sessionId/activities/:activityId/observations', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, recordActivityObservationController(sessionsService))

  server.post('/sessions/:sessionId/executions', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, registerExecutionController(sessionsService))

  server.post('/sessions/:sessionId/activities/:activityId/pause', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, pauseActivityController(sessionsService))

  server.post('/sessions/:sessionId/activities/:activityId/resume', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, resumeActivityController(sessionsService))

  server.post('/sessions/:sessionId/activities/:activityId/rest/start', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, startRestController(sessionsService))

  server.post('/sessions/:sessionId/activities/:activityId/rest/end', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, endRestController(sessionsService))

  server.post('/sessions/:sessionId/activities/:activityId/complete', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, completeActivityController(sessionsService))

  server.post('/sessions/:sessionId/finish', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, finishSessionController(sessionsService))

  server.post('/sessions/:sessionId/interrupt', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, interruptSessionController(sessionsService))

  server.get<{ Params: { sessionId: string } }>('/sessions/:sessionId', {
    preHandler: [
      authenticate,
      authorizeProfile('PROFESSIONAL')
    ]
  }, getSessionResultController(sessionsService))

  server.get<{ Params: { sessionId: string } }>('/sessions/:sessionId/result', {
    preHandler: [
      authenticate,
      authorizeProfile('PROFESSIONAL')
    ]
  }, getSessionResultController(sessionsService))

  server.get('/sessions/history', {
    preHandler: [
      authenticate,
      authorizeProfile('STUDENT')
    ]
  }, listSessionsController)
}
