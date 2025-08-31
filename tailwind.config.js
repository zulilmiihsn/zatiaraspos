/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {}
	},
	safelist: [
		'grid',
		'grid-cols-1',
		'grid-cols-2',
		'grid-cols-3',
		'grid-cols-4',
		'md:grid-cols-2',
		'md:grid-cols-3',
		'md:grid-cols-4',
		'lg:grid-cols-2',
		'lg:grid-cols-3',
		'lg:grid-cols-4',
		'gap-3',
		'gap-4',
		'aspect-[3/4]',
		'max-h-[260px]',
		'min-h-[140px]',
		'col-span-2',
		'md:col-span-3',
		'lg:col-span-4'
	],
	plugins: []
};
