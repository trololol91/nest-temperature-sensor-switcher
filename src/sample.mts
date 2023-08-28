import {} from 'lodash';

async function someFunction() {
  console.log("hello");
}

async function main() {
  console.log('Sample');
  await someFunction();
}

void main().then((_) => _);
