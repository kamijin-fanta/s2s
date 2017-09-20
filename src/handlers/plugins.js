// @flow
import path from 'path'
import chalk from 'chalk'
import { compile, getOutputPath, write, toErrorStack } from '../utils'
import type { Path, AfterHook, Plugin, PluginOpts } from '../types'
import { relativeFromCwd } from '../utils'
import runHooks from '../hooks/run'
import Lock from '../utils/lock'
import { formatText } from '../reporters/uitls'

function runPlugin(input: Path, plugin: PluginOpts) {
  const { code } = compile(input, {
    babelrc: false,
    plugins: [plugin],
  })
  if (code) {
    return code.trim()
  }
  return ''
}

export default function handlePlugins(
  watcher: Function,
  plugins: Plugin[] = [],
  hooks: AfterHook[] = []
) {
  const lock = new Lock()

  for (const type of ['add', 'change', 'unlink']) {
    watcher.on(type, (input: Path) => {
      if (lock.has(input)) {
        lock.clear()
        return
      }

      for (const plugin of plugins) {
        if (!plugin.test.test(input)) {
          continue
        }

        lock.add(input)

        const lastInput = plugin.input ? plugin.input : input

        try {
          const code = runPlugin(lastInput, plugin.plugin)

          if (!code && code === '') {
            continue
          }

          const result = runHooks(lastInput, code, hooks)

          const outputPath = plugin.output
            ? getOutputPath(plugin.output, input)
            : input
          write(outputPath, result)

          console.log(formatText('S2S', input, outputPath))
        } catch (err) {
          console.error(toErrorStack(err))
        }
      }
    })
  }
}