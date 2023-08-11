# element-templates-cli

Apply [element templates](https://github.com/bpmn-io/element-templates) on BPMN elements in your terminal.

## Installation

```sh
npm install --global element-templates-cli
```

## Usage

```sh
element-templates-cli --diagram diagram.bpmn --template template.json --element ServiceTask --output diagram_2.bpmn
```

## Additional resources

* [About element templates](https://github.com/bpmn-io/element-templates)
* [Issue tracker](https://github.com/bpmn-io/element-templates-cli/issues)
* [Forum](https://forum.bpmn.io)

## Development

Prepare the project by installing all dependencies:

```sh
npm install
```

Then, depending on your use-case, you may run any of the following commands:

```sh
# run linter, build, and test the library
npm run all

# lint
npm run lint

# build
npm run build

# test
npm test
```

## License

MIT
