"""Generates docs/architecture.png with official AWS icons.

Run from the repo root:  python docs/architecture.py
Requires: Graphviz (brew install graphviz) and the `diagrams` Python package.
"""
from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.compute import Lambda
from diagrams.aws.database import Dynamodb
from diagrams.aws.integration import SNS
from diagrams.aws.management import CloudwatchAlarm, CloudwatchLogs
from diagrams.aws.network import APIGateway, CloudFront
from diagrams.aws.security import IAMRole
from diagrams.aws.storage import S3
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.client import User, Users
from diagrams.onprem.vcs import Github

OUTPUT = Path(__file__).parent / "architecture"  # diagrams adds the .png extension

# Edge styles: one colour per flow so the three stories are easy to follow.
REQUEST = {"color": "#232F3E", "penwidth": "2"}
ALERT = {"color": "#E7157B", "style": "dashed", "penwidth": "1.5"}
DEPLOY = {"color": "#1F6FEB", "style": "dashed", "penwidth": "1.5"}

graph_attr = {
    "fontsize": "22",
    "pad": "0.5",
    "nodesep": "0.7",
    "ranksep": "0.9",
    "splines": "spline",
    "compound": "true",  # lets an arrow point at a whole group
    "labelloc": "t",
}

with Diagram(
    "LV Calculator API - AWS Architecture",
    filename=str(OUTPUT),
    outformat="png",
    show=False,
    direction="LR",
    graph_attr=graph_attr,
):
    client = Users("Client")
    owner = User("Owner\n(email alert)")

    with Cluster("AWS Cloud"):
        # IAM is global, so it sits outside the Region box.
        with Cluster("IAM (global)", graph_attr={"margin": "28"}):
            role = IAMRole("Deploy role\nresource-scoped\n+ boundary")
            exec_role = IAMRole("Lambda exec role\nPutItem/Query\n1 table + boundary")

        # CloudFront is a global edge service, so it sits outside the Region box.
        with Cluster("Edge (global)", graph_attr={"margin": "24"}):
            cdn = CloudFront("CloudFront\nHTTPS, cached")

        with Cluster("Region: us-east-1"):
            with Cluster("Website", graph_attr={"margin": "24"}):
                site = S3("Site bucket\nprivate (OAC)")

            with Cluster("Request path"):
                api = APIGateway("API Gateway\nHTTP API\n(throttled)")
                fn = Lambda("Lambda\nNode.js 22")
                table = Dynamodb("DynamoDB\non-demand,\n30-day TTL")

            with Cluster("Observability", graph_attr={"margin": "24"}):
                logs = CloudwatchLogs("CloudWatch Logs\n14-day retention")
                alarms = CloudwatchAlarm("CloudWatch\nMetrics + Alarms\nLambda errors,\nAPI 5xx")
                topic = SNS("SNS topic")

            with Cluster("Deployment", graph_attr={"margin": "24"}):
                state = S3("Terraform state\nversioned,\nnative lock")

    with Cluster("GitHub"):
        repo = Github("Repository")
        ci = GithubActions("GitHub Actions\nCI/CD")

    # 1-4: request path
    client >> Edge(label="1. open website", **REQUEST) >> cdn
    cdn >> Edge(label="static files", **REQUEST) >> site
    client >> Edge(label="2. POST /calculate\n    GET /history\n(CORS: site only,\npublic demo, no auth)", **REQUEST) >> api
    api >> Edge(label="3. invoke", **REQUEST) >> fn
    fn >> Edge(label="4. save / read", **REQUEST) >> table
    exec_role >> Edge(label="assumed by", style="dotted", color="#7D8998") >> fn

    # A-C: monitoring and alerting
    fn >> Edge(label="logs", **ALERT) >> logs
    api >> Edge(label="A. metrics\n(API + Lambda)", ltail="cluster_Request path", **ALERT) >> alarms
    alarms >> Edge(label="B. alarm", **ALERT) >> topic
    topic >> Edge(label="C. email", **ALERT) >> owner

    # i-iii: deployment
    repo >> Edge(label="i. git push", **DEPLOY) >> ci
    ci >> Edge(label="ii. OIDC\n(no stored keys)", **DEPLOY) >> role
    ci >> Edge(label="state", **DEPLOY) >> state
    role >> Edge(label="iii. terraform apply\n(all resources)", lhead="cluster_Region: us-east-1", **DEPLOY) >> api
