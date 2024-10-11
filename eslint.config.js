import bpmnIoPlugin from 'eslint-plugin-bpmn-io';

export default [
  {
    ignores: [ 'node_modules', 'dist' ],
  },
  ...bpmnIoPlugin.configs.node,
  ...bpmnIoPlugin.configs.mocha.map(config => {
    return {
      ...config,
      files: [
        'test/**/*.js',
      ]
    };
  }),
  {
    files: [ '**/*.js', '**/*.mjs' ],
  }
];