import pkg from '../package.json' with { type: 'json' };
import { exec } from 'child_process';

const command = `docker push ezemastro/loop:${pkg.version} && docker push ezemastro/loop:latest`;

exec(command, (err, stdout, stderr) => {
  if (err) {
    console.error(`Error: ${stderr}`);
    return;
  }
  console.log(stdout);
});