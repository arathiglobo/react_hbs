import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// NOTE: do NOT import bootstrap/dist/css/bootstrap.min.css here — it is global
// and re-introduces the default blue theme on top of the red SCSS build.
import "bootstrap/dist/js/bootstrap.bundle.min";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../styles/Login.css";
import "../styles/LoginModern.css";
import DashboardRedirections from "../components/DashboardRedirections";
import GloboFooterMarks from "../components/GloboFooterMarks";
import axiosInstance from "../components/AxiosInstance";
import { toast } from "react-hot-toast";
import { downloadLoginPanelPdf } from "../utils/loginPanelPdf";
import { setAuthSession, setUserId } from "../utils/authSession";

// Hotel-brand logos shown in the right-hand rail. These are the normalised
// copies in public/images/marqueeImages/mono/ — same artwork as the originals
// alongside them, but downscaled, given a real alpha channel and trimmed to
// the mark so every logo fills its cell evenly. The rail renders them as
// silhouettes, which is why the white plates had to come out first.
// Add, remove or reorder freely; the rail lays them out two per row.
const BRAND_LOGOS = [
  "Marriott-logo.png",
  "Hilton-logo.png",
  "Hyatt-Logo.png",
  "Sheraton-logo.png",
  "Four-Seasons-Logo.png",
  "IHG-Logo.png",
  "Crowne-Plaza-logo.png",
  "Holiday-Inn-logo.png",
  "Accor-logo.png",
  // ASCII filename: the ö-spelled original 404s through the dev server.
  "Movenpick-Logo.png",
  "jumeirah-logo-png_seeklogo.png",
  "Atlantis.png",
  "Taj.png",
  "Best-Western-logo.png",
];

// Value props in the strip beneath the hero.
const LOGIN_USPS = [
  {
    icon: "fa-globe",
    title: "WorldWide Inventory",
    desc: "Hotels, apartments, tours, transfers, car rentals and more.",
  },
  {
    icon: "fa-shield-alt",
    title: "Reliable & Secure",
    desc: "Trusted by thousands of travel professionals globally.",
  },
  {
    icon: "fa-headset",
    title: "Dedicated Support",
    desc: "Our team is here to help you, always.",
  },
  {
    icon: "fa-chart-line",
    title: "Grow Your Business",
    desc: "More choice. Better rates. Greater opportunities.",
  },
];

// ── About us ────────────────────────────────────────────────────────────────
// Company profile behind the footer link. Held as data rather than inline JSX
// so the modal stays one readable layout and the copy is easy to edit.
export const ABOUT_INTRO = [
  "Desert Beds LLC is a UAE-based Online Travel Agency (OTA), B2B Bedbank and Destination Management Company (DMC) focused on connecting travel professionals with quality accommodation and travel services worldwide.",
  "Built around technology, global connectivity and strong destination expertise, Desert Beds provides travel agencies, tour operators, and other travel professionals with access to a comprehensive portfolio of hotels, resorts, apartments, transfers, tours, excursions and destination services through a single B2B platform.",
];

export const ABOUT_USP_LEAD =
  "At Desert Beds LLC, we believe the future of travel is not built around a single product. It is built around choice, personalization, flexibility and seamless access to multiple travel solutions through one platform. Desert Beds brings together a diverse portfolio of accommodation, travel experiences, lifestyle products and specialized travel solutions designed to meet the evolving requirements of today’s travel industry and the next generation of travellers.";

export const ABOUT_PRODUCTS = [
  "Hotels & Resorts",
  "Apartments & Villas",
  "Student Travel",
  "Airline, Government, Hotelier & Institutional Accommodation",
  "Senior Citizen Travel",
  "Last-Minute Deals",
  "Honeymoon & Romance",
  "Holiday Packages",
  "Build Your Own Package",
  "Meetings & Event Spaces",
  "Ayurveda & Wellness",
  "Religious & Faith-Based Travel",
  "24-Hour Stay",
  "Long Stay & Extended Stay",
  "Day Stay",
  "Chauffeur & Limousine Services",
  "Tours & Activities",
  "Restaurant Reservations",
];

export const ABOUT_PLATFORM =
  "Our platform is designed to simplify the way travel businesses search, compare, book and manage travel products, offering competitive rates, real-time availability and efficient booking solutions. Through API connectivity and direct as well as strategic supplier partnerships, we aim to deliver reliable inventory and seamless distribution to our B2B partners.";

export const ABOUT_SERVICES = [
  {
    title: "B2B Bedbank",
    desc: "Global hotel and accommodation inventory with competitive wholesale rates and flexible booking solutions.",
  },
  {
    title: "Online Travel Agency (OTA)",
    desc: "A technology-driven platform enabling travel professionals to search and book accommodation and travel services efficiently.",
  },
  {
    title: "Destination Management Company (DMC)",
    desc: "Local destination expertise, including transfers, tours, excursions, sightseeing, activities and tailor-made travel arrangements.",
  },
  {
    title: "API & Connectivity",
    desc: "Technology solutions enabling travel agencies, tour operators and online platforms to connect directly with our inventory and services.",
  },
];

export const ABOUT_VISION =
  "To become a trusted global travel distribution and technology partner, connecting suppliers and travel sellers through one efficient ecosystem.";

export const ABOUT_MISSION =
  "To make travel distribution simpler, smarter and more accessible to everyone, across generations and markets, by combining innovative technology, competitive pricing, global inventory and deep destination expertise.";

export const ABOUT_WHY = [
  { emoji: "\u{1F30D}", label: "Global Accommodation & Travel Inventory" },
  { emoji: "\u{1F4BC}", label: "Dedicated B2B Solutions" },
  { emoji: "\u{1F517}", label: "API & Technology Connectivity" },
  { emoji: "\u{1F4B0}", label: "Competitive Wholesale Rates" },
  { emoji: "\u26A1", label: "Fast & Efficient Booking" },
  { emoji: "\u{1F91D}", label: "Strong Supplier & Partner Network" },
  { emoji: "\u{1F5FA}\uFE0F", label: "Destination Expertise" },
  { emoji: "\u{1F4DE}", label: "Professional B2B Support" },
];

export const ABOUT_CLOSING =
  "At Desert Beds, we believe the future of travel distribution is built on technology, connectivity and trust. Our goal is not simply to provide hotel rooms, but to create a complete travel ecosystem that helps our partners grow their business and deliver better experiences to their customers.";

// ── Privacy Policy ──────────────────────────────────────────────────────────
// B2B Partner Privacy Notice behind the footer link. Same idea as the About us
// copy: data, not JSX. Each section's `blocks` is rendered in order —
//   "string"            → paragraph
//   { sub: "…" }        → sub-heading
//   { list: [ … ] }     → bulleted list
//   { email: "…" }      → "Email: <mailto link>"
export const PRIVACY_NOTICE_TITLE = "Desert Beds B2B Partner Privacy Notice";
export const PRIVACY_EFFECTIVE_DATE = "29 June, 2026";

export const PRIVACY_SECTIONS = [
  {
    title: "Overview",
    blocks: [
      "At Desert Beds LLC (“Desert Beds ,” “we,” “us,” “our”), we pride ourselves on leading the way in online travel and becoming the best possible partner to the travel trade. This extends to the ways in which we manage the personal information of our clients and suppliers and the individuals who are, or who work for or on behalf of, our clients and suppliers (together referred to as ‘B2B Partners’). We will always be transparent about how we collect and use personal information and how we protect privacy.",
      "This Privacy Notice describes how we collect, use and process personal information in the context of performing our obligations to, and managing our business relationship with, our B2B Partners.",
      "This Privacy Notice does not apply to any personal information our B2B Partners collect independently and provide to us during the course of our business relationship (including the personal information of customers and guests of our B2B Partners).",
      "When we collect, use and process personal information relating to the customers and guests of our B2B Partners (in accordance with the provisions of the applicable contract or data processing agreement), the Desert Beds Guest Privacy Notice will apply.",
      "We are always happy to answer any questions you may have, or to provide you with any additional information that you may need. Please see the “Contact Us” section below, for details on how to get in touch with us.",
      "We review this Privacy Notice regularly to ensure that we’re being transparent about how we use your personal information. Any changes to this Privacy Notice will be reflected on our website and will take effect on the date of publication.",
    ],
  },
  {
    title: "Who are we?",
    blocks: [
      "We are Desert Beds LLC a company registered in Sharjah, United Arab Emirates with company formation number 2647237. Media City, Sharjah, United Arab Emirates. We offer a range of travel and accommodation booking services across our websites, channels and platforms. We refer to all of these services, together with our applications and websites as \"Services\" in this Privacy Notice.",
      "For the purposes of the General Data Protection Regulation 2016/679 (“GDPR”), and to the extent that we process personal information of our B2B Partners, we are an independent “data controller”. Any personal information we collect and process in this context, is necessary to enable us to manage our business relationship with our B2B Partners, supply our Services and perform our business functions and activities, including:",
      {
        list: [
          "our provision of travel and accommodation booking services;",
          "the facilitation of payments for travel and accommodation services;",
          "marketing our Services; and",
          "our compliance with our policies, procedures and legal obligations.",
        ],
      },
      "We are firmly committed to ensuring the privacy of the personal information we collect and to maintaining safeguards to protect personal information in our care. There may be instances where your local data protection laws impose more restrictive information handling practices than the practices set out in this Privacy Notice. Where this occurs, we will adjust our information handling practices in your jurisdiction, to comply with these local data protection laws.",
    ],
  },
  {
    title: "Types of personal information we collect and how we collect it",
    blocks: [
      "The types of information we collect will differ, depending on our relationship with you. Most of the information we collect from our B2B Partners is business information.",
      "In certain circumstances, we may need to collect certain types of personal information from our B2B Partners, where necessary to provide access to our Services, to manage our ongoing business relationships and to fulfil our legal and contractual obligations. Some of the information we collect from our B2B Partners may include personal information, such as:",
      "Business contact information, including business contact name and business contact details, such as business email address, business phone number, business address; and Business payment and billing information, such as business credit card and bank account details.",
      "We collect this personal information from our B2B Partners when:",
      {
        list: [
          "a user account is created by our B2B Partners, or by us on their behalf, in order to enable access to the Services,",
          "our B2B Partners (or individuals acting for or on their behalf) use our Services, to enquire about or arrange bookings via the Services; and",
          "payments for bookings are submitted via the Services.",
        ],
      },
      "We also collect personal information via our customer support channels (including via our website or customer support team) and when our B2B Partners otherwise engage with us, via phone or email.",
    ],
  },
  {
    title: "How we use the personal information we collect",
    blocks: [
      "We collect personal information in order to manage our business relationships and continue providing our Services. Having this information enables the efficiency of our Services and allows us to continue fulfilling our obligations to our B2B Partners.",
      "Further information about the specific purposes for which we use the personal information we collect, and the legal basis of our processing for those purposes, can be found below.",
      { sub: "To provide the Services" },
      "We use the personal information we collect to provide our Services, and to verify the identities of individuals using our Services (on the basis of performing our contractual obligations).",
      { sub: "To process and facilitate transactions and payments" },
      "We will use the personal information we collect to process transactions and payments, such as payments for accommodation bookings, and to collect and recover money owed to us (on the basis of performing our contractual obligations and on the basis of our legitimate interest to recover any debts due to us);",
      { sub: "To manage our business relationships" },
      "We will use personal information we collect to manage our business relationships with our B2B Partners. This includes notifying our B2B Partners of updates to our terms or to this Privacy Notice, or changes to the Services (on the basis of performing our contractual obligations or to comply with our legal obligations).",
      { sub: "To communicate with our B2B Partners about the Services" },
      "We use contact information we collect from our B2B Partners to send transactional communications via email and within the Services, including confirming bookings, reminders of payments due, responding to questions and requests, providing customer support, and sending notices (on the basis of performing our contractual obligations, or on the basis of our legitimate interests to provide customer service to our B2B Partners). We also send communications during the process of Service onboarding, to help our B2B Partners become more proficient in using our Services. These communications are part of the Services and in most cases, cannot be opted out of. If an opt-out is available, that option will be found within the communication itself (e.g. by selecting the option to “unsubscribe” in an email we have sent), or within the account settings of the Services.",
      { sub: "To market, promote and drive engagement with the Services" },
      "We use B2B Partner contact information and information about how B2B Partners use the Services, to identify and send promotional communications that may be of specific interest, including by email. These communications are aimed at driving engagement and maximising the value of the Services to our B2B Partners, including information about the latest offers and promotions that we think may be of interest. We use B2B Partner contact information for this purpose on the basis of our legitimate interests to provide marketing communications, where we may lawfully do so.",
      { sub: "To provide and improve customer support and to respond to requests" },
      "We use B2B Partner contact information to resolve issues, to respond to requests for assistance and to ensure quality assurance and security, on the basis of our legitimate interest in improving our customer support. We also use your personal information to process and respond to requests to exercise individual rights, in order to comply with our legal obligations.",
      { sub: "For research and development" },
      "We are always looking for ways to make our Services smarter, faster, more secure and useful to you, our B2B Partners. We use collective learnings about how our Services to troubleshoot and to identify trends, usage, activity patterns and areas for integration and improvement of the Services. For example, to improve a certain feature, we automatically analyse recent interactions of users and how often they use the features of the Services to gather the most relevant information. We automatically analyse and aggregate frequently used searches to improve the accuracy and relevance of suggested products. In some cases, we apply these learnings across our Services to improve and develop similar features or to better integrate the Services. We also test and analyse certain new features with some users before rolling the feature out to all users. We use personal information for this purpose on the basis of our legitimate interests to present our B2B Partners with the right kinds of products and content and to improve our products and Services.",
      { sub: "To ensure security and protect our business interests" },
      "We will use personal information where necessary to ensure the security of our Services, and people, including to protect against and investigate and deter against fraudulent, unauthorised or illegal activities, systems testing, maintenance and development (on the basis of our legitimate interests to operate a safe and lawful business, and where we have a legal obligation to do so, for establishing exercising or defending legal claims or for reasons of substantial public interest).",
      { sub: "To comply with our legal obligations, policies and procedures" },
      "We will use personal information where necessary to enable us to:",
      {
        list: [
          "comply with our policies and procedures;",
          "comply with our legal obligations (for example, our financial and tax reporting obligations, and to adhere to court orders or warrants); and",
          "enforce our legal rights and protect the rights, property and safety of our staff and others.",
        ],
      },
      "This may include sharing your personal information with our lawyers, technical advisors, law enforcement and other regulatory bodies where necessary.",
    ],
  },
  {
    title: "What is our ‘legitimate interest’?",
    blocks: [
      "In certain circumstances (as outlined above), we may use your personal information to pursue legitimate interests of our own or that of third parties, provided that your interests and fundamental rights do not override those interests. By “legitimate interests,” we mean our interests in conducting and managing our business activities and ensuring that we are guaranteeing the best service and experience for you.",
      "Where we use personal information for our legitimate interests, we make sure that we take into account any potential impact that this use may have on you. We won’t use your information if we believe your interests override ours, unless we have other lawful grounds to do so (such as with your consent, or if we have a legal obligation). If you have any questions or concerns about our processing of your personal information, you may contact us at any time.",
      "As we outline in the “Your individual rights” section below, you will have the right to object to our using your personal information for our legitimate interests. However, please keep in mind that your objection to this sort of processing may affect our ability to carry out the tasks that we have set out above.",
    ],
  },
  {
    title: "How we share the personal information we collect",
    blocks: [
      "We will only share personal information we collect with a third party if it is necessary for us to provide our Services. We have contractual provisions in place with all third parties we share personal information with, to ensure they handle this information with care, comply with all applicable laws and do not use this personal information for any other purpose.",
      "We work with third-party service providers to provide website and application development, hosting, maintenance, backup, storage, virtual infrastructure, payment processing, fraud detection, analysis and other services for us, which may require them to access or use information about we have collected from you. If a service provider needs to access this information to perform services on our behalf, they do so under close instruction from us, including policies and procedures designed to protect personal information.",
      "We work with a global network of partners who help us market and promote our products (for example, by providing consulting and sales services), who generate leads for us, help us improve our products and Services and resell our Services. We may share personal information we have collected with these partners in connection with these Services, such as to assist with marketing and promotions, or as part of our agreement with them.",
      "In exceptional circumstances, we may share personal information we have collected with a third party if we believe that sharing is reasonably necessary to:",
      {
        list: [
          "comply with any applicable law, regulation, legal process or governmental request, including to meet national security requirements;",
          "enforce our agreements, policies and terms of service;",
          "protect the security or integrity of our products and services;",
          "protect Desert Beds, our customers or the public from harm or illegal activities; or",
          "respond to an emergency which we believe in good faith requires us to disclose information to assist in preventing the death or serious bodily injury of any person.",
        ],
      },
      "We share and transfer personal information with our affiliated entities as part of our global operations. We may also share or transfer information in connection with any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company. Our B2B Partners will be notified via email and/or a prominent notice on the Services if a transaction takes place, as well as any necessary choices available concerning B2B Partner information.",
    ],
  },
  {
    title: "How we transfer personal information we collect internationally",
    blocks: [
      "We collect information globally. As part of our global operations, we may transfer, process and store B2B Partner information with our affiliates and suppliers in countries outside of your country of residence. Our data is stored in India.",
      "We may also transfer, process and store information outside of your country of residence to wherever our third-party service providers operate for the purpose of providing you with the Services. Whenever we transfer personal information, we take all necessary steps to protect it and to ensure we comply with the applicable laws.",
    ],
  },
  {
    title: "How we store and secure the personal information we collect",
    blocks: [
      { sub: "Information storage and security" },
      "We use reasonable technical and organisational measures to secure the personal information we hold.",
      "We use DB to host the information we collect. We take steps to ensure that any personal information we store with our data hosting service providers is adequately safeguarded (including contractual provisions, appropriate supervision and assessment where necessary).",
      "We cannot guarantee the security of any information or data you provide online. In the event of a serious security incident involving your personal information, we will notify you and report the incident to the relevant authorities as required by applicable law.",
      { sub: "Security of transactions" },
      "Our secure booking server uses encryption to ensure industry-standard levels of security. This is shown by the padlock in the closed position at the base of your browser screen. Any information transferred to Desert Beds through our commercial booking platforms is encrypted and securely transmitted. When your transaction is complete, your information is stored in an encrypted state. All information transmitted on the booking page is secured using layer Security.",
    ],
  },
  {
    title: "How long we keep your personal information",
    blocks: [
      "Information we collect from our B2B Partners will be retained for the duration of our contractual relationship, and for a reasonable period thereafter. We retain this information as reasonably necessary to:",
      {
        list: [
          "maintain our business records (for analysis, security, tax and/or audit purposes);",
          "handle any complaints or disputes regarding the Services;",
          "comply with our legal obligations and protect or defend our legal rights;",
          "enforce our contractual obligations and agreements; and",
          "support our business operations and continue to develop and improve our Services.",
        ],
      },
      "Where we retain information for Service improvement and development, we take steps to eliminate identifiable information, and we only use the information to uncover collective insights about the use of our Services, not to specifically analyse personal characteristics.",
      "We retain information about your marketing preferences for a reasonable period from the date you last expressed interest in our Services, such as when you last opened an email from us or ceased using the Services. We retain information derived from cookies and other tracking technologies for a reasonable period from the date such information was created.",
      "Once personal information is no longer needed to fulfil the purpose for which it was collected, we will take reasonable steps to securely destroy or de-identify that information unless we are prevented from doing so by law. If destruction or de-identification is not possible (for example, because the information has been stored in backup archives), then we will securely store your information and isolate it from any further use until secure deletion is possible.",
    ],
  },
  {
    title: "Your individual rights",
    blocks: [
      "We want to assure you that you have control of the information you choose to provide to us. Subject to certain exemptions and depending on the applicable data protection laws (including in some cases, upon our legal basis for processing your information), there are a number of rights you have over your personal information. Below is a summary of these rights and how you can exercise them:",
      {
        list: [
          "You have the right to be informed of how we collect and handle your information, as we seek to do in this Privacy Notice.",
          "You have the right to request access to the information that we hold about you.",
          "You may have the right to receive a copy of any information we hold about you (or request that we transfer this to another service provider) in a structured, commonly used, machine-readable format in certain circumstances (where we are processing this information on the basis of your consent, or where the processing is conducted on the basis of a contract);",
          "You have the right to request we correct any personal information we hold about you if you think it is incorrect, or incomplete.",
          "In certain circumstances, you may have the right to ask us to limit or cease our processing of we hold about you.",
          "You have the right to ask us not to process your information for marketing purposes (see ‘Opt-out of communications’ below). Please note that we may still need to send you communications relating to your account or your use of the Services.",
          "You may have the right to object to our processing of your personal information when such processing is based on our legitimate interests (see “What is our legitimate interest?” above). Before using your personal information for our legitimate interests, we balance these interests against your rights and freedoms; however, if you consider that you have grounds to object to this, you can explain this to us, and we will review your request.",
          "You may have the right to obtain an explanation of, and object to, any automated decision-making (including profiling) which produces a legal effect or similarly significant effects. We do use your information to personalise the Services and the offers you receive; however we do not engage in automated processing with legal or similarly significant effects.",
          "In cases where we process your personal information based on your consent, you can withdraw your consent at any time by contacting us. This does not affect the legality of any processing carried out before you withdrew your consent.",
          "If you have unresolved concerns, you also have the right to complain about us to the relevant data protection authority in the country where you live, where you work or where you feel your rights were infringed.",
        ],
      },
      "Please note that, notwithstanding the rights listed above, we reserve the right to retain certain information for our record-keeping purposes, and to defend ourselves against any legal claims.",
    ],
  },
  {
    title: "Exercising your individual rights",
    blocks: [
      "You can exercise your individual rights at any time, by contacting us using the details in the ‘Contact Us’ section below.",
      "When you make such requests, we will respond within 30 days of receipt. If there is a delay or dispute as to whether we have the right to continue using your personal information, we will restrict any further use of your information until the request is honoured or the dispute is resolved. We may ask you for additional information to confirm your identity and for security purposes, before disclosing the personal information requested by you. We reserve the right to charge a fee when permitted by law (for example, if your request is manifestly unfounded or excessive).",
      "Your request and choices may be limited in certain cases: for example, if fulfilling your request would reveal information about another person, or if you ask to delete information which we are permitted by law or have compelling legitimate interests to keep. You will not be discriminated against for having exercised your individual rights.",
      "If you have unresolved concerns, you may also have the right to complain to a data protection authority in the country where you live, where you work or where you feel your rights were infringed",
    ],
  },
  {
    title: "Opt-out of marketing communications",
    blocks: [
      "You may opt-out of receiving marketing or promotional communications from us, by contacting us as provided below to have your contact information removed from our promotional email list or registration database. You can also opt out of some notification messages in your account settings.",
    ],
  },
  {
    title: "Other important privacy information",
    blocks: [
      { sub: "Our policy towards children" },
      "The Services are not directed to individuals under 14. We do not knowingly collect personal information from children under 14 without parental or guardian consent unless allowed by relevant local laws. If we become aware that information about a minor has been collected without the appropriate consent or approval, we will take steps to delete such information. If you become aware of any circumstance where we have collected information about a minor without the appropriate consent or approval, please contact us using the contact details below.",
      { sub: "Changes to our Privacy Policy" },
      "We may change this Notice from time to time. We will post any changes on this page and, if the changes are significant, we will notify you by sending you an email notification. We encourage you to review this Notice whenever you use the Services to stay informed about our information practices and the ways you can help protect your privacy.",
      "If you disagree with any changes to this Notice, you will need to stop using the Services.",
      "If we make any changes to how you can exercise your individual rights, we will notify you.",
    ],
  },
  {
    title: "Contact Us",
    blocks: [
      "If you have any questions about this Privacy Notice or our privacy practices, if you need to access this Privacy Notice in a different format, or if you would like to exercise your individual rights, please contact us.",
      { email: "info@desertbeds.com" },
    ],
  },
];

// ── Systems Policy ──────────────────────────────────────────────────────────
// Booking, Cancellation & Complaints Policy behind the "Systems Policy" footer
// link. Numbered clauses: each section holds `clauses`, and a clause may hold
// its own `sub` clauses (1.1 → 1.1.1). Numbers are kept as data rather than
// generated so they always match the source document exactly.
export const SYSTEMS_POLICY_TITLE = "Booking, Cancellation & Complaints Policy";
export const SYSTEMS_POLICY_EFFECTIVE_DATE = "29 June, 2026";

export const SYSTEMS_POLICY_INTRO =
  "Desert Beds acts solely as an agent of Accommodation Providers to sell Accommodation Services to Buyers. Terms in this Desert Beds Booking, Cancellation and Complaints Policy apply to the Buyer and the Accommodation Provider, unless the Hotel has a conflicting term contained in its own policy, which will prevail.";

export const SYSTEMS_POLICY_SECTIONS = [
  {
    no: "1",
    title: "Definitions and interpretation",
    clauses: [
      {
        no: "1.1",
        text: "Capitalised terms in this Terms of Use have the following meanings:",
        sub: [
          { no: "1.1.1", text: "Accommodation Provider means the manager or owner of the Hotel who sells Hotel rooms to Desert Beds;" },
          { no: "1.1.2", text: "Accommodation Services means the services provided by the Hotel to the Guest in connection with their stay, which may include, but are not limited to: the provision of accommodation, room reservations and allocation, housekeeping, maintenance, and any other services reasonably associated with the Guest’s occupancy during the period of stay;" },
          { no: "1.1.3", text: "Booking Confirmation means the confirmation email sent to the Buyer on behalf of the Hotel by Desert Beds to confirm the Reservation;" },
          { no: "1.1.4", text: "Booking Request means the automatic request sent by Desert Beds via the Booking System to the Accommodation Provider for approval, upon receiving a request for a booking from a Buyer;" },
          { no: "1.1.5", text: "Booking System means the online booking system operated by Desert Beds;" },
          { no: "1.1.6", text: "Business Day means a working day other than a Saturday, a Sunday or public holiday in the jurisdiction in which the Governing Law operates;" },
          { no: "1.1.7", text: "Buyer means the travel arranger who purchases Hotel rooms from Desert Beds;" },
          { no: "1.1.8", text: "Governing Law means the Governing Law specified in the Buyer Agreement between Desert Beds and the Buyer or the Accommodation Agreement between Desert Beds and the Accommodation Provider;" },
          { no: "1.1.9", text: "Guest(s) means the occupant(s) of the Hotel room(s);" },
          { no: "1.1.10", text: "Hotel means the hotels available on the Booking System which provide the Accommodation Services;" },
          { no: "1.1.11", text: "Proposed Rate(s) means the advertised rate for the Accommodation Service or other services offered on the Booking System, per room and for the total number of nights selected;" },
          { no: "1.1.12", text: "Rate means the amount payable for the Accommodation Services or other services specified in the Reservation;" },
          { no: "1.1.13", text: "Reservation means the purchase of Accommodation Services as confirmed by a Booking Confirmation by a Buyer in the Guest’s name; and" },
          { no: "1.1.14", text: "Desert Beds means Desert Beds LLC (trading as an entity incorporated under the laws of the UAE, with Formation number 2647237 Sharjah Media City, United Arab Emirates." },
        ],
      },
      { no: "1.2", text: "This Desert Beds Booking, Cancellation and Complaints Policy is to be read in conjunction with and is subject to any other agreement between Desert Beds and a Buyer or Accommodation Provider, including but not limited to an accommodation provider agreement or buyer agreement." },
    ],
  },
  {
    no: "2",
    title: "Buyer's obligations",
    clauses: [
      { no: "2.1", text: "When making a Reservation in the Booking System, the Buyer is solely responsible for ensuring all booking details are correct, including the Hotel, room type, dates of stay and Guests details." },
      { no: "2.2", text: "The Buyer must use the reference number in the Booking Confirmation in all communications with Desert Beds about a Reservation." },
    ],
  },
  {
    no: "3",
    title: "Accommodation Provider’s obligations",
    clauses: [
      { no: "3.1", text: "Upon Desert Beds receiving a request for a booking from a Buyer, Desert Beds will issue a Booking Request to the Accommodation Provider. Within 2 Business Days of receiving the Booking Request, the Accommodation Provider may request in writing that the Booking Request or Rate be rejected or amended and provide reasons for such a request. Desert Beds will consider the request in good faith and may, at its discretion, cancel or amend the Booking Request or Rate." },
      {
        no: "3.2",
        text: "The Booking Request and Rate is accepted by the Accommodation Provider where:",
        sub: [
          { no: "3.2.1", text: "the Accommodation Provider expressly approves the Booking Request within 2 Business Days of Desert Beds sending the Booking Request (for example by clicking an acceptance link in a Booking Request email);" },
          { no: "3.2.2", text: "the Accommodation Provider does not respond within 2 Business Days of Desert Beds sending the Booking Request; or" },
          { no: "3.2.3", text: "Desert Beds does not approve the Accommodation Provider’s request to reject the Booking Request under clause 3.1." },
        ],
      },
      { no: "3.3", text: "Once a Booking Request is accepted under clause 3.2, the Rate cannot be amended and Desert Beds will issue a Booking Confirmation to the Buyer ." },
      {
        no: "3.4",
        text: "The Accommodation Provider will honour all Reservations. If a Reservation cannot be honoured by the Accommodation Provider, the Accommodation Provider must, at its own cost:",
        sub: [
          { no: "3.4.1", text: "immediately notify Desert Beds in writing stating the reasons for non-performance;" },
          { no: "3.4.2", text: "provide alternative accommodation within the same Hotel to each Guest of equal or higher standard and with the same Accommodation Services as specified in the Reservation; and" },
          { no: "3.4.3", text: "if no suitable replacement is available in the Hotel in accordance with clause 3.4.2, provide alternative accommodation to each Guest at an alternative hotel in the same locality and of equal or higher standard and with the same Accommodation Services as specified in the Reservation." },
        ],
      },
    ],
  },
  {
    no: "4",
    title: "Rates",
    clauses: [
      {
        no: "4.1",
        text: "Rates:",
        sub: [
          { no: "4.1.1", text: "include specified incidentals, such as meals, meal supplements, mini-bar, dry cleaning and laundry. Incidentals which are not specified in the Booking Confirmation are excluded from the Rate and will be payable by the Guest;" },
          { no: "4.1.2", text: "include government taxes. Unless stated otherwise on the Booking System, resort fees, city taxes or local taxes or levies are not included and will be payable by the Guest directly to the Hotel; and" },
          { no: "4.1.3", text: "are in the currency specified on the Booking Confirmation." },
        ],
      },
      { no: "4.2", text: "Rates may change in the event of any changes in government taxes. Any such charges will affect Reservations which have not yet been used by Guests." },
      { no: "4.3", text: "Desert Beds may offer an alternative rate to the Proposed Rate to the Buyer in writing, subject to availability." },
      { no: "4.4", text: "Proposed Rates and other rates offered by Desert Beds are dynamic and may not be the same as the Rate due to Desert Beds’ system of fluid pricing with Accommodation Providers." },
    ],
  },
  {
    no: "5",
    title: "Descriptions, errors and corrections",
    clauses: [
      { no: "5.1", text: "Hotel descriptions and images are provided by the Accommodation Provider. Some images may be generic and may not reflect the Accommodation Services in the Reservation (for example images may show a superior room when the Reservation is for a standard room). Desert Beds is not liable for any inaccuracies in the material." },
      { no: "5.2", text: "Hotel and Accommodation Services descriptions in the Booking System are periodically updated. If Desert Beds becomes aware of incorrect material in the Booking System concerning a Reservation, it will notify the Buyer." },
      { no: "5.3", text: "If the Buyer reasonably believes that a Rate is incorrect, it must immediately notify Desert Beds in writing. Obvious Rate errors are not valid, and the correct Rate will apply in accordance with the Buyer Agreement between Desert Beds and the Buyer." },
      { no: "5.4", text: "Desert Beds will make all reasonable efforts to ensure that the Hotel provides to the Guest the room type specified in the Reservation. However, Desert Beds does not guarantee that the room given to the Guest will match the Accommodation Services specified in the Reservation." },
      { no: "5.5", text: "Hotel ratings are provided by the Accommodation Provider. Standards and ratings may vary between countries and regions." },
    ],
  },
  {
    no: "6",
    title: "Requests for additional services",
    clauses: [
      { no: "6.1", text: "The Buyer must request directly to the Hotel any additional services it wishes to receive outside of the Accommodation Services specified in the Reservation. Desert Beds will notify a Hotel of any requests for additional services it receives from Buyers. Desert Beds is not responsible for the provision of these additional services and they do not form part of the Reservation." },
      { no: "6.2", text: "For each reservation, a maximum of five rooms and 15 nights can be booked via the Booking System." },
    ],
  },
  {
    no: "7",
    title: "Guests",
    clauses: [
      { no: "7.1", text: "Accommodation Services are for the Guest(s) named on the Booking Confirmation only. Guests must not sub-let, share or transfer any part of the Accommodation Services to an individual not listed in the Booking Confirmation." },
      { no: "7.2", text: "Guests are solely responsible for providing the Hotel with valid evidence of the Reservation and may be required to pay the relevant retail price to the Hotel if they cannot provide valid evidence." },
    ],
  },
  {
    no: "8",
    title: "Local laws and hotel policies",
    clauses: [
      { no: "8.1", text: "At least one “adult” (as defined under local laws and the Hotel’s policy), must be a Guest named in the Booking Confirmation, attend the Hotel and receive the Accommodation Services." },
      { no: "8.2", text: "Desert Beds accepts no liability for the Buyer or the Guest’s failure to comply with this clause 8." },
      { no: "8.3", text: "The Accommodation Provider and Desert Beds are not responsible for providing information on the laws and immigration/visa requirements of any country." },
    ],
  },
  {
    no: "9",
    title: "Amendment and cancellations",
    clauses: [
      { no: "9.1", text: "Notwithstanding any other clause, all Reservation amendment and cancellation requests are subject to each Hotel’s cancellation policy, which may set timeframes for when a Reservation can be amended or cancelled, and charge an associated fee." },
      {
        no: "9.2",
        text: "The Buyer may request via the Booking System to amend the Reservation to:",
        sub: [
          { no: "9.2.1", text: "amend the number of nights the Accommodation Services will be provided (where the arrival date remains the same); or" },
          { no: "9.2.2", text: "amend the Guests named on the Reservation, (“Amendment Requests”). Or send an email to the operations of Desert Beds on support@desertbeds.com which the operations will advise as per hotel policy." },
        ],
      },
      { no: "9.3", text: "Desert Beds will use its best endeavours to accommodate an Amendment Request. Desert Beds may be unable to accommodate an Amendment Request, such as where a Hotel has a minimum stay requirement." },
      { no: "9.4", text: "Any request the Buyer makes concerning a Reservation outside the Booking System may not be honoured by Desert Beds." },
      { no: "9.5", text: "Any requests which are not an Amendment Request, such as requesting a change of room type or additional room, may result in the Reservation being cancelled in accordance with the Hotel’s cancellation policy. The Buyer may request a new booking via the Booking System, which is subject to current pricing and availability." },
      { no: "9.6", text: "The Booking System will specify the amount a Rate will be refunded at the time a Reservation is cancelled. Desert Beds has the sole discretion to accept a cancellation request from a Buyer." },
      { no: "9.7", text: "Notwithstanding any other clause, a Reservation cannot be cancelled or amended (including via an Amendment Request) if the Rate is specified as not being able to be cancelled or refunded." },
      { no: "9.8", text: "Any amendments or cancellations to Reservations are not effective until Desert Beds has provided written confirmation to the Buyer." },
      { no: "9.9", text: "A Hotel will hold a room for a Guest until 11.59pm on the arrival date in the Reservation. If the Guest does not arrive by 11.59pm at the Hotel on the arrival date in the Reservation, the Hotel is not required to provide the Accommodation Services to the Guest." },
      { no: "9.10", text: "If the Guest does not attend a Hotel to receive the Accommodation Services, or if the Guest leaves the booking early, the Buyer must pay the Rate to Desert Beds, in Desert Beds’ sole discretion." },
    ],
  },
  {
    no: "10",
    title: "Complaints",
    clauses: [
      { no: "10.1", text: "Desert Beds is not liable for complaints related to a Hotel or the Accommodation Services." },
      { no: "10.2", text: "Guests must immediately report issues and complaints to the Hotel. If the Guest and or Buyer is unable to resolve the complaint directly with the Hotel, the Buyer may contact Desert Beds in writing within 30 days of the incident." },
      { no: "10.3", text: "Desert Beds will use reasonable efforts to facilitate the resolution of a complaint. The Buyer and Guest must provide all reasonable assistance and information to Desert Beds to assist in the resolution, including providing evidence, documents, photos & videos." },
      { no: "10.4", text: "The Hotel must investigate the complaint and provide a written outcome to Desert Beds within 10 days of receiving the complaint from Desert Beds." },
    ],
  },
];

// ── Terms & Conditions ──────────────────────────────────────────────────────
// Website Terms & Conditions behind the footer link. Same clause shape as the
// Systems Policy; `sub` may nest again (3.2.8 → 3.2.8.1).
export const TERMS_EFFECTIVE_DATE = "29 June 2026";

export const TERMS_INTRO_TEXT =
  "Your use of this website is subject to the terms and conditions as set out below, and may be amended from time to time by us.";

export const TERMS_CONDITIONS_SECTIONS = [
  {
    no: "1",
    title: "Introduction and acceptance",
    clauses: [
      { no: "1.1", text: "Subject to applicable laws, these Terms and Conditions, as amended from time to time, apply to your use of https://desertbeds.com / (Website). By using the Website, you agree to be bound by these Terms and Conditions." },
      { no: "1.2", text: "The Website is owned and operated by Desert Beds, a company incorporated in Sharjah, Uae with formation number 2647237 dated June 29, 2026." },
    ],
  },
  {
    no: "2",
    title: "Definitions",
    clauses: [
      {
        no: "2.1",
        text: "In these Terms and Conditions:",
        sub: [
          { no: "2.1.1", text: "Content means all information made available on the Website;" },
          { no: "2.1.2", text: "Intellectual Property Rights means current and future rights anywhere in the world under patent, copyright, trademark or trade secrets, whether or not specifically recognised or perfected under the laws of the jurisdiction in which the Booking System is provided;" },
          { no: "2.1.3", text: "Losses means all claims, losses, liabilities and damages (including taxes and related penalties) and all related costs and expenses, including reasonable legal fees, and expenses and costs of litigation, arbitration, settlement, judgement, appeal, interest and penalties; and" },
          { no: "2.1.4", text: "User Materials means any material you provide to the Website, including but not limited to hotel information and contact details." },
        ],
      },
    ],
  },
  {
    no: "3",
    title: "Acceptable use and prohibited conduct",
    clauses: [
      { no: "3.1", text: "You agree to use the Website only for lawful purposes." },
      {
        no: "3.2",
        text: "You must not:",
        sub: [
          { no: "3.2.1", text: "authorize any third party to resell or redistribute the Website;" },
          { no: "3.2.2", text: "attempt to gain unauthorised access to the Website or its systems;" },
          { no: "3.2.3", text: "reproduce, copy, resell, commercialise or redistribute any part of the Website except as expressly permitted by law or with our written consent;" },
          { no: "3.2.4", text: "remove any copyright or other proprietary rights notice included in Website;" },
          { no: "3.2.5", text: "interfere with the security or functionality of the Website;" },
          { no: "3.2.6", text: "change, modify, reverse engineer, decompile, disassemble or create derivative works from the Website;" },
          { no: "3.2.7", text: "use the Website in a way that may cause harm, disruption, or damage to us or others; and" },
          {
            no: "3.2.8",
            text: "engage in any misuse of the Website, including but not limited to:",
            sub: [
              { no: "3.2.8.1", text: "manipulating or tampering with information on the Website; or" },
              { no: "3.2.8.2", text: "introducing viruses or malicious code to the Website." },
            ],
          },
        ],
      },
    ],
  },
  {
    no: "4",
    title: "User Materials and Intellectual Property Rights",
    clauses: [
      { no: "4.1", text: "Unless expressly stated otherwise, Desert Beds retains all right, title, interest, and ownership of the Website and the Content, including all derivative works and other Intellectual Property Rights." },
      { no: "4.2", text: "You must not reproduce, distribute, modify, or exploit any Content without our prior written consent." },
      { no: "4.3", text: "To the extent permitted by applicable law, the User Materials may be used by Desert Beds as a perpetual, irrevocable, worldwide, royalty free licence as we deem fit, anywhere in the world, without obligation for compensation, and free of any moral rights, intellectual property rights and/or other proprietary rights in or to the User Materials." },
      { no: "4.4", text: "You warrant that the User Materials are accurate and do not infringe upon the Intellectual Property Rights of any third party. You are solely responsible for any errors or inaccuracies in the User Materials. You agree to indemnify us against any Losses arising from any claim that the User Materials infringes the Intellectual Property Rights of any third party." },
      { no: "4.5", text: "Notwithstanding any other clause, personal information provided through the Website will be used in accordance with Desert Beds’ Privacy Policy." },
    ],
  },
  {
    no: "5",
    title: "Warranties and disclaimers",
    clauses: [
      { no: "5.1", text: "We do not guarantee that your access to the Website will be uninterrupted or error free. We do not warrant that the Website is free from viruses." },
      { no: "5.2", text: "Desert Beds is not responsible for and does not warrant that the Content is accurate, complete, reliable, current, error-free or immune from external attacks. You acknowledge that the Website is provided on an \"as is\" basis and that you should exercise reasonable judgement in using the Website. We disclaim any representations or warranties of any kind, express or implied, including without limitation warranties of merchantability, fitness for any particular purpose, non-infringement, or as to the operation of the Website and the Content." },
      { no: "5.3", text: "We do not warrant or make any representations as to the security of the Website. You acknowledge that any information sent may be intercepted. We do not warrant that the Website or the servers which make the Website available or electronic communications sent by us are free from viruses or any other harmful elements." },
      { no: "5.4", text: "Software and forms made available for downloading from the Website are subject to the terms of the applicable license agreement. Except as provided in the applicable license agreement, the software and forms are made available for use by authorized users only and any copying, reproduction or redistribution of the software or form is expressly prohibited. We disclaim any representations or warranties of any kind, express or implied, including without limitation warranties of merchantability, fitness for any particular purpose, non-infringement, or as to the operation of and content of the software and forms." },
      { no: "5.5", text: "The Website may contain links to other websites. Those links are provided for convenience only and may refer to incomplete or outdated information. We are not responsible for the content or privacy practices associated with linked websites." },
    ],
  },
  {
    no: "6",
    title: "Liability",
    clauses: [
      { no: "6.1", text: "You indemnify us against any Losses arising from your breach of these Terms and Conditions and your access to or use of the Website or the Content." },
      { no: "6.2", text: "We are not liable for any direct, indirect, consequential, punitive, special or incidental damages (including, without limitation, damages for loss of business, contract, revenue, data, information or business interruption) arising out of the Website." },
      { no: "6.3", text: "We are not liable for any action in relation to the Website brought against us one (1) year after the date the cause of action arose." },
    ],
  },
  {
    no: "7",
    title: "Changes to these Terms and Conditions",
    clauses: [
      { no: "7.1", text: "We may update these Terms and Conditions from time to time." },
      { no: "7.2", text: "Updated Terms and Conditions will be published on the Website and apply from the date of publication." },
    ],
  },
  {
    no: "8",
    title: "Governing law and jurisdiction",
    clauses: [
      { no: "8.1", text: "These Terms and Conditions are governed by the laws of United Arab Emirates." },
      { no: "8.2", text: "You submit to the exclusive jurisdiction of the courts of United Arab Emirates." },
    ],
  },
];

// Numbered-clause renderer shared by the Systems Policy and Terms & Conditions
// panels: a fixed number column + text, recursing into `sub` so each level
// (1.1 → 1.1.1 → 1.1.1.1) steps in and gets a wider number column.
const PolicyClauses = ({ clauses, depth = 0 }) =>
  clauses.map((clause) => (
    <div
      className={`lg-policy-clause${depth > 0 ? ` lg-policy-sub lg-policy-depth-${depth}` : ""}`}
      key={clause.no}
    >
      <span className="lg-policy-no">{clause.no}</span>
      <div>
        <p>{clause.text}</p>
        {clause.sub && <PolicyClauses clauses={clause.sub} depth={depth + 1} />}
      </div>
    </div>
  ));

const PolicySections = ({ sections }) =>
  sections.map((section) => (
    <section key={section.no}>
      <h3>
        <span className="lg-policy-no">{section.no}.</span>
        {section.title}
      </h3>
      <PolicyClauses clauses={section.clauses} />
    </section>
  ));

// ── PDF downloads for the footer panels ─────────────────────────────────────
// Each builder turns the same data the panel renders into the block list that
// utils/loginPanelPdf.js lays out, so the PDF always matches what is on screen.
const buildAboutPdf = () => ({
  fileName: "Desert-Beds-About-Us.pdf",
  eyebrow: "Desert Beds LLC",
  title: "About Us",
  subtitle: "Your Global B2B Accommodation & Travel Distribution Partner",
  blocks: [
    ...ABOUT_INTRO.map((text) => ({ type: "p", text })),
    { type: "h3", text: "Our unique selling proposition" },
    { type: "lede", text: "A complete travel ecosystem." },
    { type: "p", text: ABOUT_USP_LEAD },
    { type: "bullets", items: ABOUT_PRODUCTS, columns: 2 },
    { type: "p", text: ABOUT_PLATFORM },
    { type: "h3", text: "Our services" },
    ...ABOUT_SERVICES.flatMap((svc) => [
      { type: "h4", text: svc.title },
      { type: "p", text: svc.desc },
    ]),
    { type: "h3", text: "Our vision" },
    { type: "p", text: ABOUT_VISION },
    { type: "h3", text: "Our mission" },
    { type: "p", text: ABOUT_MISSION },
    { type: "h3", text: "Why Desert Beds?" },
    { type: "bullets", items: ABOUT_WHY.map((item) => item.label), columns: 2 },
    { type: "p", text: ABOUT_CLOSING },
    { type: "signoff", text: "Desert Beds LLC - Destinations Worldwide." },
  ],
});

const buildPrivacyPdf = () => ({
  fileName: "Desert-Beds-Privacy-Policy.pdf",
  eyebrow: "Desert Beds LLC",
  title: "Privacy Policy",
  subtitle: `${PRIVACY_NOTICE_TITLE}  |  ${PRIVACY_EFFECTIVE_DATE}`,
  blocks: PRIVACY_SECTIONS.flatMap((section) => [
    { type: "h3", text: section.title },
    ...section.blocks.map((block) => {
      if (typeof block === "string") return { type: "p", text: block };
      if (block.sub) return { type: "h4", text: block.sub };
      if (block.list) return { type: "bullets", items: block.list };
      if (block.email) return { type: "email", email: block.email };
      return null;
    }),
  ]).filter(Boolean),
});

// Numbered-clause documents (Systems Policy, Terms & Conditions).
const clauseSectionsToBlocks = (sections) =>
  sections.flatMap((section) => [
    { type: "h3", no: section.no, text: section.title },
    { type: "clauses", clauses: section.clauses },
  ]);

const buildSystemsPdf = () => ({
  fileName: "Desert-Beds-Booking-Cancellation-Complaints-Policy.pdf",
  eyebrow: "Desert Beds LLC  |  Systems Policy",
  title: SYSTEMS_POLICY_TITLE,
  subtitle: SYSTEMS_POLICY_EFFECTIVE_DATE,
  blocks: [
    { type: "p", text: SYSTEMS_POLICY_INTRO },
    ...clauseSectionsToBlocks(SYSTEMS_POLICY_SECTIONS),
  ],
});

const buildTermsPdf = () => ({
  fileName: "Desert-Beds-Terms-and-Conditions.pdf",
  eyebrow: "Desert Beds LLC",
  title: "Terms & Conditions",
  subtitle: TERMS_EFFECTIVE_DATE,
  blocks: [
    { type: "p", text: TERMS_INTRO_TEXT },
    ...clauseSectionsToBlocks(TERMS_CONDITIONS_SECTIONS),
  ],
});

// Download bar pinned to the bottom of a footer panel (outside the scrolling
// body, so it is always in reach). `build` returns the PDF spec on click.
const PanelPdfDownload = ({ build }) => {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      await downloadLoginPanelPdf(build());
    } catch (err) {
      console.error("PDF download failed", err);
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="lg-about-foot">
      <span className="lg-about-foot-note">
        <i className="far fa-file-pdf" aria-hidden="true"></i>
        Save a copy of this page as a PDF
      </span>
      <button
        type="button"
        className="lg-about-download"
        onClick={handleDownload}
        disabled={busy}
      >
        <i
          className={`fas ${busy ? "fa-spinner fa-spin" : "fa-download"}`}
          aria-hidden="true"
        ></i>
        {busy ? "Preparing PDF…" : "Download PDF"}
      </button>
    </footer>
  );
};

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSystems, setShowSystems] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [forgetEmail, setForgetEmail] = useState("");
  const [forgetUsername, setForgetUsername] = useState("");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState("Agent");
  // ── Agent login OTP (second factor) ──
  // When /auth/login returns { otpRequired: true } for an agent, we open a
  // popup to collect the emailed 6-digit code and finish login via
  // /auth/verify-login-otp. No token is stored until the code is verified.
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpUsername, setOtpUsername] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [otpResendIn, setOtpResendIn] = useState(0); // resend cooldown, seconds
  // True when the backend flags this as the account's very first login —
  // never signed in before. Only ever set on the initial /auth/login response
  // (not on resend), so the welcome message stays specifically about the
  // first-time flow and doesn't reappear on later logins from the same page.
  const [otpFirstLogin, setOtpFirstLogin] = useState(false);
  // ── TOTP (Google Authenticator) second factor ──
  // Separate from the emailed-OTP flow above: the code comes from the user's
  // authenticator app, so there is nothing to send and nothing to resend. When
  // /auth/login returns { totpRequired: true } we collect the 6-digit code and
  // finish via /auth/verify-totp, echoing back the one-time twoFactorToken that
  // proves the password step just succeeded. The backend only ever sets one of
  // otpRequired / totpRequired, so the two modals can never both be open.
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpUsername, setTotpUsername] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState(null);
  const [totpSubmitting, setTotpSubmitting] = useState(false);
  const [totpFallingBack, setTotpFallingBack] = useState(false);
  // Promo carousel on the login brand panel. Two public sources feed it:
  //   1. OfferZone banners (/api/offerDetails) — shown FIRST, each carrying a
  //      description + validity dates overlaid on the banner image.
  //   2. Offer images (/api/offerImageUpload/public) — plain promo images,
  //      appended after the banners.
  // Section hides completely when neither source has anything to show.
  const [slides, setSlides] = useState([]);
  const [offerIdx, setOfferIdx] = useState(0);
  const navigate = useNavigate();

  // Escape closes the footer panels (About / Contact / Privacy / Systems /
  // Terms). Bound only while one is open so the page isn't listening for keys
  // it has no use for otherwise.
  useEffect(() => {
    if (!showAbout && !showContact && !showPrivacy && !showSystems && !showTerms) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowAbout(false);
        setShowContact(false);
        setShowPrivacy(false);
        setShowSystems(false);
        setShowTerms(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAbout, showContact, showPrivacy, showSystems, showTerms]);

  // Restore the "Remember me" username on mount. Only the username is ever
  // persisted — the password is never written to storage.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rememberedUsername");
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch (storageErr) {
      /* storage unavailable (private mode) — nothing to restore */
    }
  }, []);

  // Fetch both public sources once on mount and flatten them into a single
  // ordered list of slide objects ({ url, title?, description?, validity* }).
  useEffect(() => {
    let alive = true;
    const apiBase = process.env.REACT_APP_API_BASE_URL || "";

    Promise.all([
      axiosInstance.get("/api/offerDetails").catch(() => ({ data: [] })),
      axiosInstance
        .get("/api/offerImageUpload/public")
        .catch(() => ({ data: [] })),
    ])
      .then(([offerRes, imageRes]) => {
        if (!alive) return;
        const next = [];

        // OfferZone banners first — with text overlay (description + validity).
        // bannerImagePah is already a full /images/ URL served publicly.
        if (Array.isArray(offerRes.data)) {
          offerRes.data.forEach((offer) => {
            // An offer can carry several banners now, and each one becomes its
            // own hero slide sharing that offer’s caption. Rows written before
            // the list existed only have the single bannerImagePah.
            const urls =
              Array.isArray(offer.bannerImagePaths) &&
              offer.bannerImagePaths.length > 0
                ? offer.bannerImagePaths
                : offer.bannerImagePah
                ? [offer.bannerImagePah]
                : [];

            urls.forEach((url, i) => {
              if (!url) return;
              next.push({
                key: `offer-${offer.offerId}-${i}`,
                url,
                title: offer.title,
                description: offer.description,
                validityFrom: offer.validityFrom,
                validityTo: offer.validityTo,
              });
            });
          });
        }

        // Offer-upload images next — image only, no overlay.
        if (Array.isArray(imageRes.data)) {
          imageRes.data.forEach((set) => {
            if (set.hasImage1) {
              next.push({
                key: `img-${set.id}-1`,
                url: `${apiBase}/api/offerImageUpload/public/${set.id}/image1`,
              });
            }
            if (set.hasImage2) {
              next.push({
                key: `img-${set.id}-2`,
                url: `${apiBase}/api/offerImageUpload/public/${set.id}/image2`,
              });
            }
          });
        }

        setSlides(next);
        setOfferIdx(0);
      })
      .catch(() => {
        if (alive) setSlides([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Auto-rotate through slides when there is more than one.
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => {
      setOfferIdx((i) => (i + 1) % slides.length);
    }, 4000);
    return () => clearInterval(t);
  }, [slides]);

  // Count down the "Resend OTP" cooldown once per second while active.
  useEffect(() => {
    if (otpResendIn <= 0) return undefined;
    const t = setInterval(() => {
      setOtpResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [otpResendIn]);

  // Format a LocalDateTime string ("2026-06-22T00:00:00") to a readable date.
  const formatOfferDate = (value) => {
    if (!value) return "";
    const datePart = typeof value === "string" ? value.split("T")[0] : value;
    const d = new Date(datePart);
    if (Number.isNaN(d.getTime())) return datePart;
    return d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Store the issued token, prime per-login state, and route to the right
  // dashboard. Shared by the direct (non-agent) login and the post-OTP path so
  // both finish a login identically once a token is in hand.
  const completeLogin = async (data) => {
    const token = data?.token;
    const roles = data?.roles;
    const loginedUserName = data?.username;

    if (!token || !roles || !loginedUserName) {
      throw new Error(
        "Invalid response from server: Missing token or roles or username",
      );
    }

    // Writes to THIS tab's sessionStorage only (utils/authSession.js) — a
    // second tab logging in concurrently as a different user must never be
    // able to overwrite this tab's identity, which is exactly what sharing
    // localStorage across tabs used to do.
    setAuthSession({ token, roles, username: loginedUserName });

    // Prime userId with the caller's own entity id (for
    // agents: their agent id) BEFORE any downstream page mounts. Several
    // pages (HotelSearch, LongStaySearch, etc.) read userId synchronously
    // as the "self" agent id when building the search payload — if userId
    // is missing they lazily fetch /api/personalProfile and fall back to
    // agentId=1 in the meantime, which then flows into bookingData and
    // makes the HotelBookingPage's `/api/agent/{id}` lookup read Globo's
    // (id=1) `cardPaymentEnabled` instead of the logged-in agent's, so
    // brand-new agents incorrectly see "online card payment is not
    // enabled" on the booking page.
    // Non-blocking on failure — login itself never fails on a
    // personalProfile hiccup; the lazy fallback in downstream pages
    // remains as a safety net.
    // Drop any RegionalClock country cached by a previous user whose
    // session ended without a logout (closed browser, direct /login,
    // expired token), so this login never inherits their region.
    localStorage.removeItem("regionalClockProfile");
    try {
      const profile = await axiosInstance.get(
        `/api/personalProfile/${loginedUserName}`,
      );
      if (profile?.data?.id != null) {
        setUserId(String(profile.data.id));
      }
      // Seed the RegionalClock cache with THIS user's country so the
      // dashboard clock shows it immediately (same shape RegionalClock
      // writes itself). Skipped when no country came back — the clock
      // then fetches on its own as before.
      if (profile?.data?.countryCode) {
        localStorage.setItem(
          "regionalClockProfile",
          JSON.stringify({
            countryCode: profile.data.countryCode,
            countryName: profile.data.countryName || "",
          }),
        );
      }
    } catch (profileErr) {
      // Swallow — the per-page lazy fetch will still run.
      console.warn("Failed to prime userId at login:", profileErr);
    }

    // (adSessionId — dedupes advertisement views per login — is minted by
    // setAuthSession() above.)

    if (roles.length > 1) {
      navigate("/select-userRole", { state: { roles } });
    } else {
      DashboardRedirections(roles[0] || "User", navigate);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Remember-me only ever persists the username, never the password.
    try {
      if (rememberMe) {
        localStorage.setItem("rememberedUsername", username);
      } else {
        localStorage.removeItem("rememberedUsername");
      }
    } catch (storageErr) {
      /* storage unavailable — remember-me just won't stick */
    }

    try {
      const loginRequest = { username: `${username}`, password: `${password}` };
      const response = await axiosInstance.post("/auth/login", loginRequest, {
        withCredentials: true,
      });

      // The account has an authenticator enrolled: the backend validated the
      // password and withheld the token. Collect the code from Google Authenticator
      // instead of completing the login here. Checked before otpRequired to
      // mirror the backend's precedence.
      if (response.data?.totpRequired) {
        setTotpUsername(response.data.username || username);
        setTotpToken(response.data.twoFactorToken || "");
        setTotpCode("");
        setTotpError(null);
        setShowTotpModal(true);
        return;
      }

      // Agent accounts get a second factor: the backend has validated the
      // password, emailed a one-time code, and withheld the token. Open the
      // OTP popup instead of completing the login here.
      //
      // First-time agents (registered, admin-approved, never signed in) are
      // guaranteed to land here — the TOTP branch above cannot fire without an
      // enrolled device, and TOTP enrolment requires an authenticated session,
      // which they don't have yet. The backend flags this case with
      // firstLogin so the modal can greet them with a welcome message
      // explaining why they're getting an emailed code.
      if (response.data?.otpRequired) {
        setOtpUsername(response.data.username || username);
        setOtpEmail(response.data.email || "");
        setOtpFirstLogin(!!response.data.firstLogin);
        setOtpCode("");
        setOtpError(null);
        setOtpResendIn(30);
        setShowOtpModal(true);
        return;
      }

      await completeLogin(response.data);
    } catch (err) {
      setError("Invalid username or password");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit the 6-digit code; on success the backend returns the same
  // { token, roles, username } shape as a normal login.
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const code = otpCode.trim();
    if (code.length !== 6) {
      setOtpError("Please enter the 6-digit code sent to your email.");
      return;
    }
    setOtpSubmitting(true);
    setOtpError(null);
    try {
      const res = await axiosInstance.post(
        "/auth/verify-login-otp",
        { username: otpUsername, otp: code },
        { withCredentials: true },
      );
      // On success completeLogin navigates away, unmounting this page (and the
      // modal). If it throws, the modal stays open and shows the error below.
      await completeLogin(res.data);
    } catch (err) {
      // The backend returns 400 (not 401/403) for a bad/expired code, so it
      // lands here rather than triggering the axios refresh/session flow.
      setOtpError(
        err?.response?.data?.message ||
          "Invalid or expired code. Please try again.",
      );
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpResendIn > 0 || otpResending) return;
    setOtpResending(true);
    setOtpError(null);
    try {
      const res = await axiosInstance.post(
        "/auth/resend-login-otp",
        { username: otpUsername },
        { withCredentials: true },
      );
      if (res.data?.email) setOtpEmail(res.data.email);
      setOtpCode("");
      setOtpResendIn(30);
      toast.success("A new verification code has been sent to your email.");
    } catch (err) {
      setOtpError(
        err?.response?.data?.message ||
          "Could not resend the code. Please try again.",
      );
    } finally {
      setOtpResending(false);
    }
  };

  const closeOtpModal = () => {
    setShowOtpModal(false);
    setOtpCode("");
    setOtpError(null);
    setOtpUsername("");
    setOtpEmail("");
    setOtpResendIn(0);
    setOtpFirstLogin(false);
  };

  // Submit the 6-digit authenticator code. On success the backend returns the
  // same { token, roles, username } shape as a normal login.
  const handleVerifyTotp = async (e) => {
    if (e) e.preventDefault();
    const code = totpCode.trim();
    if (code.length !== 6) {
      setTotpError("Please enter the 6-digit code from your authenticator app.");
      return;
    }
    setTotpSubmitting(true);
    setTotpError(null);
    try {
      const res = await axiosInstance.post(
        "/auth/verify-totp",
        { username: totpUsername, otp: code, twoFactorToken: totpToken },
        { withCredentials: true },
      );
      // On success completeLogin navigates away, unmounting this page (and the
      // modal). If it throws, the modal stays open and shows the error below.
      await completeLogin(res.data);
    } catch (err) {
      // The backend returns 400 (not 401/403) for a bad, reused or rate-limited
      // code, so it lands here rather than triggering the axios refresh flow.
      setTotpError(
        err?.response?.data?.message ||
          "Invalid code. Please try again.",
      );
      // A used-up code can never work again — clear it so the user reads the
      // next one off their app rather than resubmitting the same digits.
      setTotpCode("");
    } finally {
      setTotpSubmitting(false);
    }
  };

  const closeTotpModal = () => {
    setShowTotpModal(false);
    setTotpCode("");
    setTotpError(null);
    setTotpUsername("");
    // Drop the one-time token too — going back to the login form abandons this
    // login attempt entirely, and the token is useless without a fresh password
    // step anyway.
    setTotpToken("");
  };

  // "Lost my authenticator" escape hatch. Trades the mid-flight TOTP challenge
  // (via the single-use twoFactorToken) for an emailed code, then hands off to
  // the existing email-OTP modal. The backend consumes the pending TOTP row on
  // the server side, so there is no going back to the authenticator for this
  // sign-in — the user has to complete the email flow or start over.
  const handleTotpFallbackToEmail = async () => {
    if (totpFallingBack || totpSubmitting) return;
    setTotpFallingBack(true);
    setTotpError(null);
    try {
      const res = await axiosInstance.post(
        "/auth/totp-fallback-email",
        { username: totpUsername, twoFactorToken: totpToken },
        { withCredentials: true },
      );
      // Both the direct email-OTP path and this fallback path return the
      // address unmasked (`email`). The code is going to the user's own
      // inbox; there is no leak in showing them where it went.
      const email = res.data?.email || "";
      const uname = res.data?.username || totpUsername;
      // Close the authenticator modal and hand the sign-in over to the email
      // flow. The existing verify-login-otp path handles it from here — same
      // OTP modal, same submit endpoint, same resend cooldown.
      setShowTotpModal(false);
      setTotpCode("");
      setTotpToken("");
      setOtpUsername(uname);
      setOtpEmail(email);
      setOtpCode("");
      setOtpError(null);
      setOtpResendIn(30);
      setShowOtpModal(true);
      toast.success(
        email
          ? `A verification code has been sent to ${email}.`
          : "A verification code has been sent to your email.",
      );
    } catch (err) {
      setTotpError(
        err?.response?.data?.message ||
          "Could not send an email code. Please try again.",
      );
    } finally {
      setTotpFallingBack(false);
    }
  };

  const [forgetSubmitting, setForgetSubmitting] = useState(false);

  const handleForgetPasswordSubmit = async (e) => {
    e.preventDefault();
    const email = forgetEmail.trim();
    const username = forgetUsername.trim();
    if (!email || !username) {
      toast.error("Please enter both your email and username.");
      return;
    }
    try {
      setForgetSubmitting(true);
      await axiosInstance.post("/auth/forgot-password", { email, username });
      // The backend responds the same way whether or not the account
      // exists (anti-enumeration), so the message is deliberately generic.
      toast.success(
        "If the email and username match an account, a new password has been emailed to you."
      );
      setForgetEmail("");
      setForgetUsername("");
      const modal = document.getElementById("exampleModal");
      if (modal && window.bootstrap?.Modal) {
        const bootstrapModal = window.bootstrap.Modal.getInstance(modal);
        if (bootstrapModal) bootstrapModal.hide();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Could not process the request. Please try again."
      );
    } finally {
      setForgetSubmitting(false);
    }
  };

  return (
    <div className="lg-shell">
      {/* ── Main row · hero stage (left) + hotel-brand rail (right) ── */}
      <div className="lg-row">
        <div className="lg-col">
          {/* ── Stage · hero photo, brand copy and the sign-in card ── */}
          <section className="lg-stage">
            {/* Hero backdrop · the banners published on /offer (and
                /upload-offer-image), cross-fading every few seconds. All of
                them are stacked and toggled by opacity rather than swapping a
                single src, so the browser has each one decoded before it is
                shown and the transition can't flash.

                The bundled photo is only the empty state: it shows while
                nothing is published (or while the fetch is in flight) so the
                page never renders on a blank stage. */}
            {slides.length > 0 ? (
              slides.map((slide, i) => (
                <img
                  key={slide.key}
                  src={slide.url}
                  alt={slide.title || `Offer ${i + 1}`}
                  className={`lg-stage-photo${
                    i === offerIdx ? " is-active" : ""
                  }`}
                />
              ))
            ) : (
              <img
                src={`${process.env.PUBLIC_URL}/images/login-hero.jpg`}
                alt=""
                aria-hidden="true"
                className="lg-stage-photo is-active"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = `${process.env.PUBLIC_URL}/images/main-slider.jpg`;
                }}
              />
            )}
            {/* Left-to-right white wash so the navy headline stays readable
                over the photo while the right half keeps the imagery. */}
            <div className="lg-stage-wash" aria-hidden="true" />

            <div className="lg-portal">B2B Portal &amp; DMC</div>

            <div className="lg-stage-inner">
              {/* ── Brand copy ── */}
              <div className="lg-copy">
                <div className="lg-logo-wrap">
                  <img
                    src={`${process.env.PUBLIC_URL}/images/desert-white.PNG`}
                    alt="Desert Beds"
                    className="lg-logo"
                  />
                  <div className="lg-logo-tag">destinations worldwide</div>
                </div>

                <h1 className="lg-title">
                  Your Global Travel
                   Partner
                </h1>

                <p className="lg-sub">
                  Access worldwide hotels, transfers, tours, attractions and
                  more — all in one place.
                </p>

                {/* ── Offer strip ──
                    The banners themselves are the hero backdrop above; this is
                    just the caption for whichever one is showing plus the
                    carousel controls. Hidden entirely when nothing is
                    published. */}
                {slides.length > 0 && (
                  <div className="lg-offerbar">
                    {(() => {
                      const active = slides[offerIdx] || {};
                      const hasCopy =
                        active.title ||
                        active.description ||
                        active.validityFrom ||
                        active.validityTo;
                      if (!hasCopy) return null;
                      return (
                        <div className="lg-offerbar-copy">
                          <span className="lg-offerbar-pill">
                            <i className="fas fa-tag"></i> Offer
                          </span>
                          {active.title && (
                            <span className="lg-offerbar-title">
                              {active.title}
                            </span>
                          )}
                          {active.description && (
                            <p className="lg-offerbar-desc">
                              {active.description}
                            </p>
                          )}
                          {(active.validityFrom || active.validityTo) && (
                            <span className="lg-offerbar-validity">
                              <i className="fas fa-calendar-alt"></i>
                              {active.validityFrom && active.validityTo
                                ? `${formatOfferDate(
                                    active.validityFrom,
                                  )} – ${formatOfferDate(active.validityTo)}`
                                : active.validityFrom
                                ? `From ${formatOfferDate(active.validityFrom)}`
                                : `Until ${formatOfferDate(active.validityTo)}`}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                  </div>
                )}
              </div>

              {/* ── Sign-in card ── */}
              <div className="lg-card">
                <h2 className="lg-card-title">
                  <span>B2B</span> Login
                </h2>
                <p className="lg-card-sub">
                  Sign In to your account to access our global travel inventory
                  and exclusive rates.
                </p>

                <form onSubmit={handleSubmit} autoComplete="on">
                  <div className="lg-input">
                    <i className="fas fa-user lg-input-ico"></i>
                    <input
                      id="username"
                      type="text"
                      placeholder="Username"
                      aria-label="Username"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="lg-input">
                    <i className="fas fa-lock lg-input-ico"></i>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      aria-label="Password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="lg-eye"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      <i
                        className={
                          showPassword ? "fas fa-eye-slash" : "fas fa-eye"
                        }
                      ></i>
                    </button>
                  </div>

                  {error && <div className="lg-error">{error}</div>}

                  <div className="lg-meta">
                    <label className="lg-check">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="lg-check-ui" aria-hidden="true">
                        <i className="fas fa-check"></i>
                      </span>
                      <span>Remember me</span>
                    </label>

                    <button
                      type="button"
                      className="lg-forgot"
                      data-bs-toggle="modal"
                      data-bs-target="#exampleModal"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="lg-submit"
                    disabled={submitting}
                  >
                    {submitting ? (
                      "Signing in…"
                    ) : (
                      <>
                        Log In <i className="fas fa-arrow-right"></i>
                      </>
                    )}
                  </button>
                </form>

                <div className="lg-divider">
                  <span>New to Desert Beds?</span>
                </div>

                <button
                  type="button"
                  className="lg-ghost"
                  onClick={() => {
                    setSelectedRole("Agent");
                    setShowRoleModal(true);
                  }}
                >
                  <i className="fas fa-user-plus"></i> Create Account
                </button>
              </div>
            </div>

            {/* Carousel dots, centred along the bottom of the hero. A sibling of
                the content column rather than a child of the caption, so they
                centre on the banner instead of on whatever copy sits bottom-left. */}
            {slides.length > 1 && (
              <div className="lg-stage-dots">
                {slides.map((slide, i) => (
                  <button
                    key={slide.key}
                    type="button"
                    aria-label={`Show offer ${i + 1}`}
                    aria-current={i === offerIdx}
                    className={`lg-stage-dot${
                      i === offerIdx ? " is-active" : ""
                    }`}
                    onClick={() => setOfferIdx(i)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Value strip ── */}
          <div className="lg-usp">
            {LOGIN_USPS.map((usp) => (
              <div className="lg-usp-item" key={usp.title}>
                <i className={`fas ${usp.icon}`}></i>
                <div>
                  <div className="lg-usp-title">{usp.title}</div>
                  <p className="lg-usp-desc">{usp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Hotel-brand rail ── */}
        <aside className="lg-rail" aria-label="Hotel brands we work with">
          {/* The list is rendered twice so the marquee can loop without a seam:
              the track scrolls by exactly one copy, then restarts. Cells are a
              fixed height for that reason — with uneven cells, half the track
              would not line up with one copy and the loop would jump. */}
          <div className="lg-rail-track">
            {[...BRAND_LOGOS, ...BRAND_LOGOS].map((file, i) => (
              <div className="lg-rail-cell" key={`${file}-${i}`}>
                <img
                  src={encodeURI(
                    `${process.env.PUBLIC_URL}/images/marqueeImages/mono/${file}`,
                  )}
                  alt=""
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ── Bottom bar ── */}
      <footer className="lg-footbar">
        <div className="lg-footbar-left">
          <span>
            © {new Date().getFullYear()} Globosoft. All rights reserved.
          </span>
        </div>
        <div className="lg-footbar-mid">
          <button
            type="button"
            className="lg-footbar-link"
            onClick={() => setShowAbout(true)}
          >
            About us
          </button>
          {/* Phone + email live in the Contact us pop-up instead of being
              spelled out in the bar. */}
          <button
            type="button"
            className="lg-footbar-link"
            onClick={() => setShowContact(true)}
          >
            Contact us
          </button>
          <button
            type="button"
            className="lg-footbar-link"
            onClick={() => setShowPrivacy(true)}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            className="lg-footbar-link"
            onClick={() => setShowSystems(true)}
          >
            Systems Policy
          </button>
          <button
            type="button"
            className="lg-footbar-link"
            onClick={() => setShowTerms(true)}
          >
            Terms and Conditions
          </button>
          {/* Moved out of the right-hand corner to free it for the Globosoft
              wordmark; the pipe separators came along with them. */}
          <span className="lg-footbar-regions">
            <span>UAE</span>
            <span>UK</span>
            <span>India</span>
          </span>
        </div>
        {/* "Powered by" + the red wordmark. tone="light" because this bar is
            white; the left-hand mark is deliberately gone, so the attribution
            sits alone in the right corner. */}
        <div className="lg-footbar-right">
          <GloboFooterMarks side="right" tone="light" label="Powered by" />
        </div>
      </footer>

      {/* ── About us ── */}
      {showAbout && (
        <div
          className="lg-about-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lg-about-title"
          onClick={() => setShowAbout(false)}
        >
          <div className="lg-about" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lg-about-close"
              onClick={() => setShowAbout(false)}
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>

            <header className="lg-about-head">
              <p className="lg-about-eyebrow">Desert Beds LLC</p>
              <h2 id="lg-about-title">About Us</h2>
              <p className="lg-about-tagline">
                Your Global B2B Accommodation &amp; Travel Distribution Partner
              </p>
            </header>

            <div className="lg-about-body">
              {ABOUT_INTRO.map((para) => (
                <p key={para.slice(0, 32)}>{para}</p>
              ))}

              <h3>Our unique selling proposition</h3>
              <p className="lg-about-lede">A complete travel ecosystem.</p>
              <p>{ABOUT_USP_LEAD}</p>

              <ul className="lg-about-chips">
                {ABOUT_PRODUCTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <p>{ABOUT_PLATFORM}</p>

              <h3>Our services</h3>
              <div className="lg-about-services">
                {ABOUT_SERVICES.map((svc) => (
                  <div className="lg-about-service" key={svc.title}>
                    <div className="lg-about-service-title">{svc.title}</div>
                    <p>{svc.desc}</p>
                  </div>
                ))}
              </div>

              <div className="lg-about-split">
                <section>
                  <h3>Our vision</h3>
                  <p>{ABOUT_VISION}</p>
                </section>
                <section>
                  <h3>Our mission</h3>
                  <p>{ABOUT_MISSION}</p>
                </section>
              </div>

              <h3>Why Desert Beds?</h3>
              <ul className="lg-about-why">
                {ABOUT_WHY.map((item) => (
                  <li key={item.label}>
                    <span aria-hidden="true">{item.emoji}</span>
                    {item.label}
                  </li>
                ))}
              </ul>

              <p>{ABOUT_CLOSING}</p>

              <p className="lg-about-signoff">
                Desert Beds LLC &mdash; Destinations Worldwide.
              </p>
            </div>

            <PanelPdfDownload build={buildAboutPdf} />
          </div>
        </div>
      )}

      {/* ── Contact us ── */}
      {/* Same shell as About us, sized down to a compact card. Each row is a
          tel:/mailto: link so a click dials or opens the mail client. */}
      {showContact && (
        <div
          className="lg-about-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lg-contact-title"
          onClick={() => setShowContact(false)}
        >
          <div
            className="lg-about lg-contact"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="lg-about-close"
              onClick={() => setShowContact(false)}
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>

            <header className="lg-about-head">
              <p className="lg-about-eyebrow">Desert Beds LLC</p>
              <h2 id="lg-contact-title">Contact Us</h2>
              <p className="lg-about-tagline">
                We&rsquo;re here to help &mdash; reach us by phone or email.
              </p>
            </header>

            <div className="lg-contact-body">
              <a className="lg-contact-row" href="tel:+971563269000">
                <span className="lg-contact-icon" aria-hidden="true">
                  <i className="fas fa-phone-alt"></i>
                </span>
                <span className="lg-contact-text">
                  <span className="lg-contact-label">Phone</span>
                  <span className="lg-contact-value">+971 56 326 9000</span>
                </span>
              </a>
              <a className="lg-contact-row" href="mailto:info@desertbeds.com">
                <span className="lg-contact-icon" aria-hidden="true">
                  <i className="fas fa-envelope"></i>
                </span>
                <span className="lg-contact-text">
                  <span className="lg-contact-label">Email</span>
                  <span className="lg-contact-value">info@desertbeds.com</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Privacy Policy ── */}
      {/* Same shell as About us; the long notice scrolls inside the body while
          the title and close button stay put. */}
      {showPrivacy && (
        <div
          className="lg-about-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lg-privacy-title"
          onClick={() => setShowPrivacy(false)}
        >
          <div className="lg-about" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lg-about-close"
              onClick={() => setShowPrivacy(false)}
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>

            <header className="lg-about-head">
              <p className="lg-about-eyebrow">Desert Beds LLC</p>
              <h2 id="lg-privacy-title">Privacy Policy</h2>
              <p className="lg-about-tagline">
                {PRIVACY_NOTICE_TITLE} &middot; {PRIVACY_EFFECTIVE_DATE}
              </p>
            </header>

            <div className="lg-about-body lg-privacy">
              {PRIVACY_SECTIONS.map((section) => (
                <section className="lg-privacy-section" key={section.title}>
                  <h3>{section.title}</h3>
                  {section.blocks.map((block, i) => {
                    if (typeof block === "string") {
                      return <p key={i}>{block}</p>;
                    }
                    if (block.sub) {
                      return <h4 key={i}>{block.sub}</h4>;
                    }
                    if (block.list) {
                      return (
                        <ul key={i} className="lg-privacy-list">
                          {block.list.map((item) => (
                            <li key={item.slice(0, 40)}>{item}</li>
                          ))}
                        </ul>
                      );
                    }
                    if (block.email) {
                      return (
                        <p key={i}>
                          Email:{" "}
                          <a href={`mailto:${block.email}`}>{block.email}</a>
                        </p>
                      );
                    }
                    return null;
                  })}
                </section>
              ))}
            </div>

            <PanelPdfDownload build={buildPrivacyPdf} />
          </div>
        </div>
      )}

      {/* ── Systems Policy (Booking, Cancellation & Complaints) ── */}
      {/* Same shell as the other footer panels; clauses render as a number
          column + text so the 1.1 / 1.1.1 hierarchy reads at a glance. */}
      {showSystems && (
        <div
          className="lg-about-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lg-systems-title"
          onClick={() => setShowSystems(false)}
        >
          <div className="lg-about" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lg-about-close"
              onClick={() => setShowSystems(false)}
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>

            <header className="lg-about-head">
              <p className="lg-about-eyebrow">Desert Beds LLC &middot; Systems Policy</p>
              <h2 id="lg-systems-title">{SYSTEMS_POLICY_TITLE}</h2>
              <p className="lg-about-tagline">{SYSTEMS_POLICY_EFFECTIVE_DATE}</p>
            </header>

            <div className="lg-about-body lg-policy">
              <p>{SYSTEMS_POLICY_INTRO}</p>
              <PolicySections sections={SYSTEMS_POLICY_SECTIONS} />
            </div>

            <PanelPdfDownload build={buildSystemsPdf} />
          </div>
        </div>
      )}

      {/* ── Terms & Conditions ── */}
      {/* Same shell and numbered-clause layout as the Systems Policy. */}
      {showTerms && (
        <div
          className="lg-about-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lg-terms-title"
          onClick={() => setShowTerms(false)}
        >
          <div className="lg-about" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lg-about-close"
              onClick={() => setShowTerms(false)}
              aria-label="Close"
            >
              <i className="fas fa-times"></i>
            </button>

            <header className="lg-about-head">
              <p className="lg-about-eyebrow">Desert Beds LLC</p>
              <h2 id="lg-terms-title">Terms &amp; Conditions</h2>
              <p className="lg-about-tagline">{TERMS_EFFECTIVE_DATE}</p>
            </header>

            <div className="lg-about-body lg-policy">
              <p>{TERMS_INTRO_TEXT}</p>
              <PolicySections sections={TERMS_CONDITIONS_SECTIONS} />
            </div>

            <PanelPdfDownload build={buildTermsPdf} />
          </div>
        </div>
      )}

      {/* ── Role Selection Modal ── */}
      {showRoleModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1060,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShowRoleModal(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 12, padding: "32px 36px",
              minWidth: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h5 style={{ marginBottom: 20, fontWeight: 700, color: "#1a1a2e" }}>
              <i className="fas fa-user-circle me-2"></i>Create Account As
            </h5>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
              {["Agent", "Hotel", "Supplier", "DMC"].map((role) => (
                <label
                  key={role}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    cursor: "pointer", padding: "10px 14px",
                    border: `2px solid ${selectedRole === role ? "#c0392b" : "#e0e0e0"}`,
                    borderRadius: 8,
                    background: selectedRole === role ? "#fff5f5" : "#fafafa",
                    fontWeight: selectedRole === role ? 600 : 400,
                    color: "#1a1a2e",
                    transition: "all 0.15s",
                  }}
                >
                  <input
                    type="radio"
                    name="registerRole"
                    value={role}
                    checked={selectedRole === role}
                    onChange={() => setSelectedRole(role)}
                    style={{ accentColor: "#c0392b", width: 18, height: 18 }}
                  />
                  <i
                    className={`fas ${
                      role === "Agent"
                        ? "fa-briefcase"
                        : role === "Hotel"
                          ? "fa-hotel"
                          : role === "Supplier"
                            ? "fa-truck"
                            : "fa-map-marked-alt"
                    } me-1`}
                  ></i>
                  {role === "DMC" ? "DMC" : role}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                style={{
                  padding: "8px 22px", borderRadius: 7, border: "1px solid #ccc",
                  background: "#fff", color: "#555", cursor: "pointer", fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  // Supplier / DMC share one form (PartnerRegisterFromOut)
                  // parameterised by route; Agent / Hotel unchanged.
                  const registerPath = {
                    Hotel: "/hotel-register",
                    Supplier: "/supplier-register",
                    DMC: "/dmc-register",
                  };
                  navigate(registerPath[selectedRole] || "/register");
                }}
                style={{
                  padding: "8px 22px", borderRadius: 7, border: "none",
                  background: "#c0392b", color: "#fff", cursor: "pointer", fontWeight: 600,
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Agent Login OTP Modal ── */}
      {showOtpModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1070,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 12, padding: "30px 34px",
              width: 400, maxWidth: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: "50%", background: "#fff5f5",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#c0392b", fontSize: 22, marginBottom: 12,
                }}
              >
                <i className={`fas ${otpFirstLogin ? "fa-hand-sparkles" : "fa-shield-alt"}`}></i>
              </div>
              <h5 style={{ margin: 0, fontWeight: 700, color: "#1a1a2e" }}>
                {otpFirstLogin ? "Welcome — let's verify your email" : "Verify it's you"}
              </h5>
              <p style={{ margin: "8px 0 0", color: "#6c757d", fontSize: 14 }}>
                {otpFirstLogin ? (
                  <>
                    This is your first sign-in, so we&apos;ve emailed a 6-digit
                    verification code
                    {otpEmail ? (
                      <>
                        {" "}to{" "}
                        <strong style={{ wordBreak: "break-word" }}>
                          {otpEmail}
                        </strong>
                      </>
                    ) : null}
                    . Enter it below to finish signing in.
                  </>
                ) : (
                  <>
                    We&apos;ve emailed a 6-digit verification code
                    {otpEmail ? (
                      <>
                        {" "}to{" "}
                        <strong style={{ wordBreak: "break-word" }}>
                          {otpEmail}
                        </strong>
                      </>
                    ) : null}
                    . Enter it below to finish signing in.
                  </>
                )}
              </p>
            </div>

            {otpFirstLogin && (
              <div
                style={{
                  marginTop: 14, padding: "10px 12px",
                  background: "#e6f4ea", border: "1px solid #b7e0c1",
                  borderRadius: 8, color: "#1e5631", fontSize: 12,
                }}
              >
                <i className="fas fa-info-circle me-2"></i>
                For your first sign-in, verification is by email only. Once
                you&apos;re in, you can set up an authenticator app under
                Two-Factor Authentication if you prefer.
              </div>
            )}

            <form onSubmit={handleVerifyOtp}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (otpError) setOtpError(null);
                }}
                placeholder="••••••"
                aria-label="6-digit verification code"
                style={{
                  width: "100%", textAlign: "center", letterSpacing: "0.5em",
                  fontSize: 24, fontWeight: 600, padding: "12px 14px",
                  border: `2px solid ${otpError ? "#c0392b" : "#e0e0e0"}`,
                  borderRadius: 8, outline: "none", marginTop: 16, boxSizing: "border-box",
                }}
              />

              {otpError && (
                <div
                  style={{
                    color: "#c0392b", fontSize: 13, marginTop: 10, textAlign: "center",
                  }}
                >
                  {otpError}
                </div>
              )}

              <button
                type="submit"
                disabled={otpSubmitting || otpCode.length !== 6}
                style={{
                  width: "100%", marginTop: 18, padding: "11px 0", borderRadius: 8,
                  border: "none",
                  background: otpSubmitting || otpCode.length !== 6 ? "#e39b93" : "#c0392b",
                  color: "#fff", fontWeight: 600, fontSize: 15,
                  cursor: otpSubmitting || otpCode.length !== 6 ? "not-allowed" : "pointer",
                }}
              >
                {otpSubmitting ? "Verifying…" : "Verify & Sign In"}
              </button>
            </form>

            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={closeOtpModal}
                style={{
                  border: "none", background: "none", color: "#6c757d",
                  cursor: "pointer", fontSize: 13, padding: 0,
                }}
              >
                <i className="fas fa-arrow-left me-1"></i> Back to login
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={otpResendIn > 0 || otpResending}
                style={{
                  border: "none", background: "none",
                  color: otpResendIn > 0 || otpResending ? "#adb5bd" : "#c0392b",
                  cursor: otpResendIn > 0 || otpResending ? "default" : "pointer",
                  fontWeight: 600, fontSize: 13, padding: 0,
                }}
              >
                {otpResending
                  ? "Sending…"
                  : otpResendIn > 0
                  ? `Resend in ${otpResendIn}s`
                  : "Resend code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Authenticator (Google Authenticator) TOTP Modal ── */}
      {showTotpModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1070,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 12, padding: "30px 34px",
              width: 400, maxWidth: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 6 }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: "50%", background: "#fff5f5",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#c0392b", fontSize: 22, marginBottom: 12,
                }}
              >
                <i className="fas fa-mobile-alt"></i>
              </div>
              <h5 style={{ margin: 0, fontWeight: 700, color: "#1a1a2e" }}>
                Two-factor authentication
              </h5>
              <p style={{ margin: "8px 0 0", color: "#6c757d", fontSize: 14 }}>
                Open <strong>Google Authenticator</strong> and enter the 6-digit code shown
                for this account to finish signing in.
              </p>
            </div>

            <form onSubmit={handleVerifyTotp}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={totpCode}
                onChange={(e) => {
                  setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (totpError) setTotpError(null);
                }}
                placeholder="••••••"
                aria-label="6-digit authenticator code"
                style={{
                  width: "100%", textAlign: "center", letterSpacing: "0.5em",
                  fontSize: 24, fontWeight: 600, padding: "12px 14px",
                  border: `2px solid ${totpError ? "#c0392b" : "#e0e0e0"}`,
                  borderRadius: 8, outline: "none", marginTop: 16, boxSizing: "border-box",
                }}
              />

              {totpError && (
                <div
                  style={{
                    color: "#c0392b", fontSize: 13, marginTop: 10, textAlign: "center",
                  }}
                >
                  {totpError}
                </div>
              )}

              <button
                type="submit"
                disabled={totpSubmitting || totpCode.length !== 6}
                style={{
                  width: "100%", marginTop: 18, padding: "11px 0", borderRadius: 8,
                  border: "none",
                  background: totpSubmitting || totpCode.length !== 6 ? "#e39b93" : "#c0392b",
                  color: "#fff", fontWeight: 600, fontSize: 15,
                  cursor: totpSubmitting || totpCode.length !== 6 ? "not-allowed" : "pointer",
                }}
              >
                {totpSubmitting ? "Verifying…" : "Verify & Sign In"}
              </button>
            </form>

            {/* No "resend" here — unlike the emailed code, the authenticator
                generates a new one every 30 seconds on the user's own device. */}

            {/* "OR" divider, then the email fallback. The divider uses two flex
                lines around the word to avoid a single hairline underlining a
                middle span, which drifts by 1px depending on browser DPI. */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10, margin: "18px 0 12px",
              }}
              aria-hidden="true"
            >
              <div style={{ flex: 1, height: 1, background: "#eef0f2" }} />
              <span style={{ color: "#adb5bd", fontSize: 11, letterSpacing: "0.08em" }}>
                OR
              </span>
              <div style={{ flex: 1, height: 1, background: "#eef0f2" }} />
            </div>

            <button
              type="button"
              onClick={handleTotpFallbackToEmail}
              disabled={totpFallingBack || totpSubmitting}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 8,
                border: "1px solid #c0392b",
                background: "#fff",
                color: totpFallingBack || totpSubmitting ? "#adb5bd" : "#c0392b",
                fontWeight: 600, fontSize: 14,
                cursor: totpFallingBack || totpSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {totpFallingBack ? (
                "Sending code…"
              ) : (
                <>
                  <i className="fas fa-envelope me-2"></i>
                  Send a code to my email instead
                </>
              )}
            </button>

            <div
              style={{
                marginTop: 6, color: "#6c757d", fontSize: 12, textAlign: "center",
              }}
            >
              Can't access your authenticator app?
            </div>

            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button
                type="button"
                onClick={closeTotpModal}
                style={{
                  border: "none", background: "none", color: "#6c757d",
                  cursor: "pointer", fontSize: 13, padding: 0,
                }}
              >
                <i className="fas fa-arrow-left me-1"></i> Back to login
              </button>
            </div>

            <div
              style={{
                marginTop: 14, paddingTop: 12, borderTop: "1px solid #f0f0f0",
                color: "#adb5bd", fontSize: 12, textAlign: "center",
              }}
            >
              Still stuck? Contact your administrator.
            </div>
          </div>
        </div>
      )}

      {/* ── Forgot Password Modal ── */}
      <div
        className="modal fade"
        id="exampleModal"
        tabIndex="-1"
        aria-labelledby="exampleModalLabel"
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h1 className="modal-title fs-5" id="exampleModalLabel">
                <i className="fas fa-key me-2"></i>
                Reset Your Password
              </h1>
              <button
                type="button"
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              <p className="modal-description text-muted mb-3">
                Enter the email and username on your account. We'll email a new
                password to the address on file.
              </p>
              <form id="changePass" onSubmit={handleForgetPasswordSubmit} autoComplete="off">
                <div className="mb-3">
                  <label className="form-label" htmlFor="forgetmail">
                    <span className="text-danger">*</span> Email Address
                  </label>
                  <input
                    type="email"
                    id="forgetmail"
                    className="form-control"
                    name="forgetmail"
                    placeholder="Enter your email address"
                    value={forgetEmail}
                    onChange={(e) => setForgetEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="userCode">
                    <span className="text-danger">*</span> Username
                  </label>
                  <input
                    type="text"
                    id="userCode"
                    className="form-control"
                    name="userCode"
                    placeholder="Enter your username"
                    value={forgetUsername}
                    onChange={(e) => setForgetUsername(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  id="submit"
                  className="btn w-100 lg-submit"
                  style={{ marginTop: 4 }}
                  disabled={forgetSubmitting}
                >
                  {forgetSubmitting ? "Sending…" : "Send New Password"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
