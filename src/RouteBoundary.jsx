import { Component, createRef, lazy, Suspense } from "react";
import Icon from "./Icons.jsx";
import BloomLoader from "./BloomLoader.jsx";
import "./route-boundary.css";

export default class RouteBoundary extends Component {
  state = { error: null, Page: lazy(this.props.load) };
  heading = createRef();

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch() {
    this.heading.current?.focus();
  }

  retry = () => {
    // A rejected React.lazy object keeps its error; a new object allows a new import attempt.
    this.setState({ error: null, Page: lazy(this.props.load) });
  };

  render() {
    const { title, pageProps } = this.props;
    if (this.state.error) return (
      <section className="route-state route-error" role="alert">
        <Icon name="flower" />
        <span className="eyebrow">{title}</span>
        <h1 ref={this.heading} tabIndex={-1}>Chưa mở được <em>trang này.</em></h1>
        <p>Kết nối có thể bị gián đoạn. Thử lại để tiếp tục; giỏ hoa và phiên hiện tại vẫn được giữ.</p>
        <div className="route-actions">
          <button className="button primary" onClick={this.retry}>Thử tải lại</button>
          <a className="button outline" href="/#collection">Về bộ sưu tập</a>
        </div>
      </section>
    );
    const Page = this.state.Page;
    return (
      <Suspense fallback={
        <BloomLoader label={title} />
      }>
        <Page {...pageProps} />
      </Suspense>
    );
  }
}
