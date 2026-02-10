export default {
  '**/*.{ts,tsx,js,jsx,json}': (filenames) => {
    // Diviser en petits groupes de 10 fichiers pour éviter SIGKILL
    const batchSize = 10
    const commands = []

    for (let i = 0; i < filenames.length; i += batchSize) {
      const batch = filenames.slice(i, i + batchSize)
      commands.push(`biome check --write --no-errors-on-unmatched --files-ignore-unknown=true ${batch.join(' ')}`)
    }

    return commands
  }
}
