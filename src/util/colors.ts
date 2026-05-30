import chalk from "chalk";

function colors() {
	console.log("Use dot notation to use the text colors");
}

colors.blue = (text: string) => {
	console.log(chalk.blue(text));
};
colors.red = (text: string) => {
	console.log(chalk.red(text));
};
colors.green = (text: string) => {
	console.log(chalk.green(text));
};
colors.yellow = (text: string) => {
	console.log(chalk.yellow(text));
};
colors.purple = (text: string) => {
	console.log(chalk.magenta(text));
};

colors.brightBlue = (text: string) => {
	console.log(chalk.blueBright(text));
};
colors.brightRed = (text: string) => {
	console.log(chalk.redBright(text));
};

export default colors;
