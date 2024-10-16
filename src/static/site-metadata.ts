interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const data: ISiteMetadataResult = {
  siteTitle: 'Fariacool Running Page',
  siteUrl: 'https://github.com/Fariacool',
  logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTtc69JxHNcmN1ETpMUX4dozAgAN6iPjWalQ&usqp=CAU',
  description: 'Fariacool Running Page',
  navLinks: [
    {
      name: 'About',
      url: 'https://github.com/Fariacool',
    },
  ],
};

export default data;
