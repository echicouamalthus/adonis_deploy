import hash from '@adonisjs/core/services/hash'
import User from '#users/models/user'

/**
 * Factory pour créer un utilisateur de test
 */
export async function createUser(
  options: { email?: string; fullName?: string; credits?: number } = {}
): Promise<User> {
  return User.create({
    fullName: options.fullName || 'Test User',
    email: options.email || `test-${Date.now()}-${Math.random()}@example.com`,
    password: await hash.make('password123'),
    credits: options.credits ?? 3,
  })
}
