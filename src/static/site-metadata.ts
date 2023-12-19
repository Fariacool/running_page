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
  siteTitle: 'F4ria Running Page',
  siteUrl: 'https://github.com/F4ria',
  logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQTtc69JxHNcmN1ETpMUX4dozAgAN6iPjWalQ&usqp=CAU',
  description: 'F4ria Running Page',
  navLinks: [
    {
      name: 'About',
      url: 'https://github.com/F4ria',
    },
  ],
};

export default data;
