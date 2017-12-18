module.exports = {
    module: {
        rules: [
            {
                test: /.jsx?$/,
                use: 'babel-loader',
                exclude: /node_modules/,
            },
            {
                test: /.css$/,
                use: [
                    {loader: 'style-loader'},
                    {loader: 'css-loader'},
                ],
            },
            {
                test: /\.(png|jpg|gif)$/,
                use: 'url-loader',
            },
        ],
    },
};
