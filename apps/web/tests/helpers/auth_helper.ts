import User from '#users/models/user'
import { createUser } from './user_factory.js'

/**
 * Crée un client authentifié avec le guard 'api' (Bearer token)
 * Crée manuellement un token d'accès et l'injecte dans les headers
 *
 * @param client - Le client Japa
 * @param user - L'utilisateur à authentifier
 */
export async function loginAsUser(client: any, user: User): Promise<any> {
  const token = await User.accessTokens.create(user)
  return client.header('Authorization', `Bearer ${token.value!.release()}`)
}

/**
 * Crée un utilisateur ET retourne un client authentifié
 * Utilitaire pour simplifier les tests
 */
export async function createAndLoginUser(
  client: any,
  options = {}
): Promise<{ user: User; authClient: any }> {
  const user = await createUser(options)
  const authClient = await loginAsUser(client, user)
  return { user, authClient }
}
